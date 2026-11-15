import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { sendFeedback } from '../controllers/feedbackController.js';

const feedbackRouter = express.Router();

feedbackRouter.post('/', userAuth, sendFeedback);

export default feedbackRouter;
