import express from 'express'
import { login, logout, register, sendVerifyOtp, verifyEmail, isAuthenticated, sendResetPasswordOtp, resetPassword, googleLogin} from '../controllers/authController.js'
import userAuth from '../middleware/userAuth.js'

const authRouter = express.Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/logout', logout);
authRouter.post('/send-verify-otp', userAuth, sendVerifyOtp);
authRouter.post('/verify-email', userAuth, verifyEmail);
authRouter.post('/is-authenticated', userAuth, isAuthenticated);
authRouter.post('/send-reset-otp', sendResetPasswordOtp);
authRouter.post('/reset-password', resetPassword);
authRouter.post('/google', googleLogin);

export default authRouter;