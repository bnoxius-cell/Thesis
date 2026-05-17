import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { submitPSS, submitWHO } from '../controllers/surveyController.js';

const surveyRouter = express.Router();
surveyRouter.post('/pss', userAuth, submitPSS);
surveyRouter.post('/who', userAuth, submitWHO);
export default surveyRouter;