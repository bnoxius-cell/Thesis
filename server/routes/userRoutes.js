    import express from 'express'
import userAuth from '../middleware/userAuth.js'
import { getUserData, updateProfile, acceptTerms } from '../controllers/userController.js';

const userRouter = express.Router();

userRouter.get('/data', userAuth, getUserData)
userRouter.put('/profile', userAuth, updateProfile)
userRouter.post('/accept-terms', userAuth, acceptTerms)

export default userRouter;