import express from 'express'
import userAuth from '../middleware/userAuth.js'
import { getUserData, updateProfile, updateAvatar, getPublicProfile, acceptTerms, markNotesSeen, saveGuide, getSetup } from '../controllers/userController.js';

const userRouter = express.Router();

userRouter.get('/data', userAuth, getUserData)
userRouter.put('/profile', userAuth, updateProfile)
userRouter.get('/profile/:userId', userAuth, getPublicProfile)
userRouter.put('/avatar', userAuth, updateAvatar)
userRouter.post('/accept-terms', userAuth, acceptTerms)
userRouter.post('/notes-seen', userAuth, markNotesSeen)
userRouter.post('/guide', userAuth, saveGuide)
userRouter.get('/setup', userAuth, getSetup)

export default userRouter;
