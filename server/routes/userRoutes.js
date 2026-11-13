import express from 'express'
import userAuth from '../middleware/userAuth.js'
import { getUserData, updateProfile, updateAvatar, getPublicProfile, acceptTerms, markNotesSeen } from '../controllers/userController.js';

const userRouter = express.Router();

userRouter.get('/data', userAuth, getUserData)
userRouter.put('/profile', userAuth, updateProfile)
userRouter.get('/profile/:userId', userAuth, getPublicProfile)
userRouter.put('/avatar', userAuth, updateAvatar)
userRouter.post('/accept-terms', userAuth, acceptTerms)
userRouter.post('/notes-seen', userAuth, markNotesSeen)

export default userRouter;
