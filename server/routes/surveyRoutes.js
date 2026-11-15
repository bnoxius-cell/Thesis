import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { submitPSS, submitWHO, getHistory, setContext } from '../controllers/surveyController.js';

const surveyRouter = express.Router();
surveyRouter.post('/pss', userAuth, submitPSS);
surveyRouter.post('/who', userAuth, submitWHO);
surveyRouter.get('/history', userAuth, getHistory);
surveyRouter.patch('/:kind/:id/context', userAuth, setContext);
export default surveyRouter;