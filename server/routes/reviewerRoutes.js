import express from 'express';
import multer from 'multer';
import userAuth from '../middleware/userAuth.js';
import {
    createReviewer, getReviewers, getReviewer, getReviewerStatus, updateReviewer, regenerateReviewer, requestTargeted, deleteReviewer,
    startSession, getSession, answerQuestion, finishSession, getProgress,
} from '../controllers/reviewerController.js';
import {
    BODY_OVERHEAD_BYTES, MAX_SOURCES, MAX_SOURCE_BYTES, MAX_SOURCES_BYTES, SourceError, sendSourceError, sourceSlots,
} from '../utils/reviewerSource.js';

// Notes arrive as a text field of at most 100,000 characters; this leaves room for multi-byte ones.
const MAX_FIELD_BYTES = 512 * 1024;

// Answers before the body is read. The request is drained so the client gets the answer instead of
// a broken connection.
const refuse = (req, res, error) => {
    req.resume();
    sendSourceError(res, error);
};

// The length is checked up front, so a body that is too big is never buffered. Node holds the
// sender to the length it announced, and a chunked body has none to check, so it is refused.
const bodyCap = (req, res, next) => {
    const length = Number(req.headers['content-length']);
    if (!Number.isSafeInteger(length) || length < 0) return refuse(req, res, new SourceError('no_length'));
    if (length > MAX_SOURCES_BYTES + BODY_OVERHEAD_BYTES) return refuse(req, res, new SourceError('too_big_together'));
    next();
};

// Only a couple of requests hold file bytes at once. The slot goes back when the response is closed
// (done, failed or dropped). A request whose job still holds picture bytes after it has answered takes
// the slot over with res.locals.keepSlot(), and the job releases it; release is safe to call twice.
const takeSourceSlot = (req, res, next) => {
    const release = sourceSlots.take();
    if (!release) return refuse(req, res, new SourceError('busy'));
    let kept = false;
    res.locals.keepSlot = () => {
        kept = true;
        return release;
    };
    res.once('close', () => { if (!kept) release(); });
    next();
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

const uploadSources = (req, res, next) => parseSources(req, res, (error) => (error ? sendSourceError(res, uploadError(error)) : next()));

const reviewerRouter = express.Router();

// userAuth runs first so nobody signed out gets a file buffered; the size and slot checks come
// before multer reads anything.
reviewerRouter.post('/', userAuth, bodyCap, takeSourceSlot, uploadSources, createReviewer);
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
