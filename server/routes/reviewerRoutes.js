import express from 'express';
import multer from 'multer';
import userAuth from '../middleware/userAuth.js';
import {
    createReviewer, getReviewers, getReviewer, getReviewerStatus, updateReviewer, regenerateReviewer, deleteReviewer,
    startSession, getSession, answerQuestion, finishSession, getProgress,
} from '../controllers/reviewerController.js';

export const MAX_PDF_BYTES = 10 * 1024 * 1024;

// The PDF is kept in memory only long enough to pull its text out. Render's free tier has no
// lasting disk, and the file itself is never stored.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PDF_BYTES, files: 1, fields: 10 },
    fileFilter: (req, file, cb) => {
        const looksLikePdf = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname || '');
        cb(looksLikePdf ? null : new Error('ONLY_PDF'), looksLikePdf);
    },
});

// Multer's own errors would otherwise reach Express's default HTML error page.
const uploadPdf = (req, res, next) => upload.single('pdf')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, message: 'That PDF is too big. The limit is 10 MB.' });
    }
    if (error.message === 'ONLY_PDF') {
        return res.status(400).json({ success: false, message: 'Only PDF files can be uploaded.' });
    }
    return res.status(400).json({ success: false, message: "The upload didn't go through. Try again." });
});

const reviewerRouter = express.Router();

// userAuth runs first so nobody signed out gets a file buffered.
reviewerRouter.post('/', userAuth, uploadPdf, createReviewer);
reviewerRouter.get('/', userAuth, getReviewers);

reviewerRouter.get('/:reviewerId', userAuth, getReviewer);
reviewerRouter.get('/:reviewerId/status', userAuth, getReviewerStatus);
reviewerRouter.patch('/:reviewerId', userAuth, updateReviewer);
reviewerRouter.post('/:reviewerId/regenerate', userAuth, regenerateReviewer);
reviewerRouter.delete('/:reviewerId', userAuth, deleteReviewer);
reviewerRouter.get('/:reviewerId/progress', userAuth, getProgress);

reviewerRouter.post('/:reviewerId/sessions', userAuth, startSession);
reviewerRouter.get('/:reviewerId/sessions/:sessionId', userAuth, getSession);
reviewerRouter.post('/:reviewerId/sessions/:sessionId/answer', userAuth, answerQuestion);
reviewerRouter.post('/:reviewerId/sessions/:sessionId/finish', userAuth, finishSession);

export default reviewerRouter;
