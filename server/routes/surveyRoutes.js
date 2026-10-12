import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { submitPSS, submitWHO, getHistory } from '../controllers/surveyController.js';

const surveyRouter = express.Router();
surveyRouter.post('/pss', userAuth, submitPSS);
surveyRouter.post('/who', userAuth, submitWHO);
surveyRouter.get('/history', userAuth, getHistory);
export default surveyRouter;