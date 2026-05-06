import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';
import { sendPasswordResetEmail, sendVerifyEmailOtp, sendWelcomeEmail } from '../utils/emailService.js';
import { generateOtp } from '../utils/generateOtp.js';
import { validateLoginFields, validateRegisterFields, validateResetPasswordFields, validateVerifyEmailFields } from '../utils/validators.js';

export const register = async (req, res) => {
    const { name, email, password } = req.body;

    const validate = validateRegisterFields(name, email, password);
    if (!validate.isValid) {
        return res.status(400).json(validate.message);
    }

    try {
        const existingUser = await userModel.findOne({ email });
        
        if (existingUser) {
            if (existingUser.authProvider === 'google') {
                return res.json({ success: false, message: "This email is already registered with Google. Please use Google Login" });
            }
            if (existingUser.authProvider === 'local') {
                return res.json({ success: false, message: "Email already exists." });
            }
        }
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = new userModel({
            name,
            email,
            password: hashedPassword
        });
        await user.save();

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '12h' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            maxAge: 12 * 60 * 60 * 1000
        });

        return res.json({ success: true, message: "Register successful. Please check your email to verify your account" });
    } catch (error) {
        return res.json({ success: false, message: error.message});
    }
};

export const login = async (req, res) => {
    const { email, password } = req.body;

    const validate = validateLoginFields(email, password);
    if (!validate.isValid) {
        return res.status(400).json(validate);
    }

    try {
        const user = await userModel.findOne({ email });
        if (!user) {
            return res.json({ success: false, message: "User not found. Please enter a valid email." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.json({ success: false, message: "Incorrect password. Please try again."})
        }

        const jwtExpiry = rememberMe ? '30d' : '1d';
        const cookieAge = rememberMe 
            ? 30 * 24 * 60 * 60 * 1000 
            : 1 * 24 * 60 * 60 * 1000;

        // token and cookie distribution upon login
        const token = jwt.sign({id: user._id}, process.env.JWT_SECRET, {expiresIn: jwtExpiry});

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            maxAge: cookieAge
        })
        return res.json({success: true, message: 'Login successful'})
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const logout = async (req, res) => {
    try {
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
        });

        return res.json({ success: true, message: 'Logout successful' });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const sendVerifyOtp = async (req, res) => {
    try {
        const { userId } = req.body;

        const user = await userModel.findById(userId);

        if (user.isAccountVerified) {
            return res.json({success: false, message: 'Email is already verified.'});
        }

        const otp = generateOtp();
        user.verifyEmailOtp = otp;
        user.verifyEmailOtpExpireAt = Date.now() + 20 * 60 * 1000; // 20 min otp expiry
        await user.save();

        await sendVerifyEmailOtp(user.email, otp);

        return res.json({ success: true, message: 'OTP sent successfully.' })

    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const verifyEmail = async (req, res) => {
    const {userId, otp} = req.body;

    const validate = validateVerifyEmailFields(userId, otp);
    if (!validate.isValid) {
        return res.json(validate);
    }

    try {
        const user = await userModel.findById(userId);

        if (!user) {
            return res.json({ success: false, message: 'User not found.' });
        }
        if (user.verifyOtp === '' || user.verifyOtp != otp) {
            return res.json({ success: false, message: 'Invalid OTP.' })
        }
        if (user.verifyOtpExpireAt < Date.now()) {
            return res.json({success: false, message: 'OTP has expired.'})
        }

        user.isAccountVerified = true;
        user.verifyEmailOtp = '';
        user.verifyEmailOtpExpireAt = 0;
        await user.save();

        await sendWelcomeEmail(user.email);

        return res.json({ success: true, message: 'Email verified successfully.' });

    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const isAuthenticated = async (req, res) => {
    try {
        return res.json({success: true, message: 'User is authenticated'})
    } catch (error) {
        return res.json({success: false, message: error.message})
    }
};

export const sendResetPasswordOtp = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.json({success: false, message: 'Email is required'})
    }
    
    try {
        const user = await userModel.findOne({ email });

        if (!user) {
            return res.json({success: false, message: 'User not found.'});
        }
        
        const otp = generateOtp();

        user.resetPasswordOtp = otp;
        user.resetPasswordOtpExpireAt = Date.now() + 20 * 60 * 1000; // 20 min otp expiry
        await user.save();

        await sendPasswordResetEmail(email, otp);

        return res.json({ success: true, message: 'OTP sent successfully.' });
        
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const resetPassword = async (req, res) => {
    const { email, otp, password } = req.body;

    const validate = validateResetPasswordFields(email, otp, password);
    if (!validate.isValid) {
        return res.status(400).json(validate.message);
    }

    try {
        const user = await userModel.findOne({ email });

        if (!user) {
            return res.json({ success: false, message: 'User not found.' })
        }

        if (user.resetPasswordOtp === '' || user.resetPasswordOtp != otp) {
            return res.json({ success: false, message: 'Invalid OTP.' })
        }
        if (user.resetPasswordOtpExpireAt < Date.now()) {
            return res.json({ success: false, message: 'OTP has expired.' })
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        user.password = hashedPassword;
        user.resetPasswordOtp = '';
        user.resetPasswordOtpExpireAt = 0;
        await user.save();

        await sendPasswordResetSuccessEmail(email);

    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

