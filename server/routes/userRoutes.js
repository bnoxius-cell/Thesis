    import express from 'express'
import userAuth from '../middleware/userAuth.js'
import { getUserData, updateProfile } from '../controllers/userController.js';

const userRouter = express.Router();

userRouter.get('/data', userAuth, getUserData)
userRouter.put('/profile', userAuth, updateProfile)

export default userRouter;