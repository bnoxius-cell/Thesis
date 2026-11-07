import express from 'express';
import multer from 'multer';
import userAuth from '../middleware/userAuth.js';
import {
    createReviewer, getReviewers, getReviewer, getReviewerStatus, updateReviewer, regenerateReviewer, requestTargeted, deleteReviewer,
    startSession, getSession, answerQuestion, finishSession, getProgress,
} from '../controllers/reviewerController.js';
import {
    BODY_OVERHEAD_BYTES, MAX_SOURCES, MAX_SOURCE_BYTES, MAX_SOURCES_BYTES, SourceError, sendSourceError, sourceSettings, sourceSlots,
} from '../utils/reviewerSource.js';
import { allowBurst } from '../utils/fileResponse.js';
import { getFileLimits } from '../utils/fileLimits.js';

// Notes arrive as a text field of at most 100,000 characters; this leaves room for multi-byte ones.
const MAX_FIELD_BYTES = 512 * 1024;

// For an answer sent before the body is read, or while it is still arriving: Node closes the
// connection after it instead of reading the rest of a body nobody needs (a chunked one could
// otherwise keep it busy until the server's own timeout).
const closeAfterAnswer = (res) => res.set('Connection', 'close');

const refuse = (res, error) => {
    closeAfterAnswer(res);
    sendSourceError(res, error);
};

// The length is checked up front, so a body that is too big is never buffered. Node holds the
// sender to the length it announced, and a chunked body has none to check, so it is refused.
const bodyCap = (req, res, next) => {
    const length = Number(req.headers['content-length']);
    if (!Number.isSafeInteger(length) || length < 0) return refuse(res, new SourceError('no_length'));
    if (length > MAX_SOURCES_BYTES + BODY_OVERHEAD_BYTES) return refuse(res, new SourceError('too_big_together'));
    next();
};

// Counted before the body is read. A file refused as unreadable costs no daily charge, so this is
// what stops a student from making the server unpack file after file.
const reviewerBurst = (req, res, next) => {
    closeAfterAnswer(res);
    if (!allowBurst(res, `reviewer:${req.userId}`, getFileLimits().reviewerBurst)) return;
    res.removeHeader('Connection');
    next();
};

// Only a couple of requests hold file bytes at once, and one student holds at most one of them. Until
// createReviewer starts, the slot goes back when the response is closed (refused, too slow, or dropped
// while the body was arriving). From then on it is held until createReviewer settles, even if the
// student leaves, because the files are still being read. A job that still holds picture bytes after
// the answer takes the slot over with res.locals.keepSlot() and releases it itself.
const takeSourceSlot = (req, res, next) => {
    if (sourceSlots.holds(req.userId)) return refuse(res, new SourceError('busy_you'));
    const release = sourceSlots.take(req.userId);
    if (!release) return refuse(res, new SourceError('busy'));
    const slot = { release, started: false, closed: false, kept: false };
    res.locals.sourceSlot = slot;
    res.locals.keepSlot = () => {
        slot.kept = true;
        return release;
    };
    res.once('close', () => {
        slot.closed = true;
        if (!slot.started) release();
    });
    next();
};

const holdingSourceSlot = (handler) => async (req, res) => {
    const slot = res.locals.sourceSlot;
    // The student left as the body finished arriving: nobody is waiting, and the slot is already back.
    if (slot.closed) return;
    slot.started = true;
    try {
        await handler(req, res);
    } finally {
        if (!slot.kept) slot.release();
    }
};

// The files are kept in memory only long enough to pull their text out. Render's free tier has no
// lasting disk, and the files themselves are never stored. What a file really is comes from its
// bytes (createReviewer), so there is no file filter. `pdf` is the field the old client sends.
const parseSources = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_SOURCE_BYTES, files: MAX_SOURCES, fields: 12, fieldSize: MAX_FIELD_BYTES, parts: 24 },
}).fields([{ name: 'files', maxCount: MAX_SOURCES }, { name: 'pdf', maxCount: 1 }]);

// Multer's own errors would otherwise reach Express's default HTML error page.
const uploadError = (error) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') return new SourceError('file_too_big');
        if (error.code === 'LIMIT_FILE_COUNT' || (error.code === 'LIMIT_UNEXPECTED_FILE' && error.field === 'files')) {
            return new SourceError('too_many_files');
        }
        if (error.code === 'LIMIT_FIELD_VALUE' && error.field === 'notes') return new SourceError('notes_long');
    }
    return new SourceError('bad_upload');
};

// The whole body has to arrive within sourceSettings.bodyReadMs. One trickled in slower is answered
// and its connection closed, which ends multer's read as well.
const uploadSources = (req, res, next) => {
    const deadline = setTimeout(() => refuse(res, new SourceError('slow_upload')), sourceSettings.bodyReadMs);
    parseSources(req, res, (error) => {
        clearTimeout(deadline);
        if (res.headersSent) return;
        if (error) return sendSourceError(res, uploadError(error));
        next();
    });
};

const reviewerRouter = express.Router();

// userAuth runs first so nobody signed out gets a file buffered; the size, burst and slot checks come
// before multer reads anything.
reviewerRouter.post('/', userAuth, bodyCap, reviewerBurst, takeSourceSlot, uploadSources, holdingSourceSlot(createReviewer));
reviewerRouter.get('/', userAuth, getReviewers);

reviewerRouter.get('/:reviewerId', userAuth, getReviewer);
reviewerRouter.get('/:reviewerId/status', userAuth, getReviewerStatus);
reviewerRouter.patch('/:reviewerId', userAuth, updateReviewer);
reviewerRouter.post('/:reviewerId/regenerate', userAuth, regenerateReviewer);
reviewerRouter.post('/:reviewerId/targeted', userAuth, requestTargeted);
reviewerRouter.delete('/:reviewerId', userAuth, deleteReviewer);
reviewerRouter.get('/:reviewerId/progress', userAuth, getProgress);

reviewerRouter.post('/:reviewerId/sessions', userAuth, startSession);
reviewerRouter.get('/:reviewerId/sessions/:sessionId', userAuth, getSession);
reviewerRouter.post('/:reviewerId/sessions/:sessionId/answer', userAuth, answerQuestion);
reviewerRouter.post('/:reviewerId/sessions/:sessionId/finish', userAuth, finishSession);

export default reviewerRouter;
