import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { submitWHO } from '../controllers/wellbeingController.js';

const wellbeingRouter = express.Router();
wellbeingRouter.post('/who', userAuth, submitWHO);
export default wellbeingRouter;