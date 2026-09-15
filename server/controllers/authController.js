import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';
import { sendPasswordResetEmail, sendPasswordResetSuccessEmail, sendVerifyEmailOtp, sendWelcomeEmail } from '../utils/emailService.js';
import { generateOtp } from '../utils/generateOtp.js';
import { validateLoginFields, validateRegisterFields, validateResetPasswordFields, validateVerifyEmailFields, validateEmail } from '../utils/validators.js';
import { verifyGoogleIdToken } from '../utils/googleAuth.js';

const normalizeEmail = (email) => String(email).trim().toLowerCase();

// Case-insensitive lookup so accounts saved with mixed-case emails (before normalization)
// still match the lowercase email Google returns.
const findUserByEmail = (email) => {
    const escaped = normalizeEmail(email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return userModel.findOne({ email: new RegExp(`^${escaped}$`, 'i') });
};

export const register = async (req, res) => {
    const { name, password } = req.body;
    const email = req.body.email ? normalizeEmail(req.body.email) : req.body.email;

    const validate = validateRegisterFields(name, email, password);
    if (!validate.isValid) {
        return res.json({ success: false, message: validate.message });
    }

    try {
        const existingUser = await findUserByEmail(email);

        if (existingUser) {
            if (existingUser.authProvider === 'google') {
                return res.json({ success: false, message: "This email is already registered with Google. Please use Google Login" });
            }
            return res.json({ success: false, message: "Email already exists." });
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
    const { email, password, rememberMe } = req.body;

    const validate = validateLoginFields(email, password);
    if (!validate.isValid) {
        return res.json({ success: false, message: validate.message });
    }

    try {
        const user = await findUserByEmail(email);
        if (!user) {
            return res.json({ success: false, message: "User not found. Please enter a valid email." });
        }

        const isMatch = user.password ? await bcrypt.compare(password, user.password) : false;
        if (!isMatch) {
            if (user.authProvider === 'google') {
                return res.json({ success: false, message: "This account uses Google sign-in. Please continue with Google." });
            }
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

export const googleLogin = async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.json({ success: false, message: 'Missing Google Token' });
    }

    try {
        const ticket = await verifyGoogleIdToken(token);
        const payload = ticket.getPayload();
        const { name, sub: googleId, picture, email_verified } = payload;
        const email = payload.email ? normalizeEmail(payload.email) : '';

        if (!email || !email_verified) {
            return res.json({ success: false, message: "Your Google account email is not verified." });
        }

        if (!validateEmail(email)) {
            return res.json({ success: false, message: "Please use your Fatima student email (@student.fatima.edu.ph)." });
        }

        let user = await findUserByEmail(email);

        if (user) {
            // Link the Google identity to the existing account. Google auth also confirms the email.
            let changed = false;
            if (!user.isAccountVerified) { user.isAccountVerified = true; changed = true; }
            if (!user.googleId) { user.googleId = googleId; changed = true; }
            if (!user.avatar && picture) { user.avatar = picture; changed = true; }
            if (changed) await user.save();
        } else {
            // Create user. Generate a random password since Mongoose schema requires it.
            const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(randomPassword, salt);

            user = new userModel({
                name,
                email,
                password: hashedPassword,
                authProvider: 'google',
                googleId,
                avatar: picture,
                isAccountVerified: true // Google accounts are implicitly verified
            });
            await user.save();
        }

        // Generate standard JWT token to mimic local login behavior
        const jwtToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.cookie('token', jwtToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });

        return res.json({ success: true, message: 'Google login successful' });
    } catch (error) {
        return res.json({ success: false, message: 'Google authentication failed: ' + error.message });
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
        const userId = req.userId;

        const user = await userModel.findById(userId);

        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

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
    const userId = req.userId;
    const { otp } = req.body;

    const validate = validateVerifyEmailFields(userId, otp);
    if (!validate.isValid) {
        return res.json({ success: false, message: validate.message });
    }

    try {
        const user = await userModel.findById(userId);

        if (!user) {
            return res.json({ success: false, message: 'User not found.' });
        }
        if (user.verifyEmailOtp === '' || user.verifyEmailOtp != otp) {
            return res.json({ success: false, message: 'Invalid OTP.' })
        }
        if (user.verifyEmailOtpExpireAt < Date.now()) {
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
        const user = await findUserByEmail(email);

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
        return res.json({ success: false, message: validate.message });
    }

    try {
        const user = await findUserByEmail(email);

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

        await sendPasswordResetSuccessEmail(user.email);

        return res.json({ success: true, message: 'Password reset successfully.' });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};
