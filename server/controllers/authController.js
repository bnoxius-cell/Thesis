import { timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';
import { sendPasswordResetEmail, sendPasswordResetSuccessEmail, sendVerifyEmailOtp, sendWelcomeEmail } from '../utils/emailService.js';
import { generateOtp } from '../utils/generateOtp.js';
import { validateLoginFields, validateRegisterFields, validateResetPasswordFields, validateVerifyEmailFields } from '../utils/validators.js';
import { verifyGoogleIdToken } from '../utils/googleAuth.js';
import { LEGAL_VERSION } from '../utils/legal.js';
import { serverError } from '../utils/httpErrors.js';

const OTP_LIFETIME_MS = 20 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const CODE_WRONG = "That code isn't right. Check the email and try again.";
const CODE_EXPIRED = 'That code has expired. Ask for a new one.';
const CODE_USED_UP = 'Too many wrong tries. Ask for a new code.';

const OTP_FIELDS = {
    verify: { code: 'verifyEmailOtp', expireAt: 'verifyEmailOtpExpireAt', attempts: 'verifyEmailOtpAttempts' },
    reset: { code: 'resetPasswordOtp', expireAt: 'resetPasswordOtpExpireAt', attempts: 'resetPasswordOtpAttempts' },
};

const normalizeEmail = (email) => String(email).trim().toLowerCase();

const codesMatch = (stored, submitted) => {
    const a = Buffer.from(stored);
    const b = Buffer.from(String(submitted).trim());
    return a.length === b.length && timingSafeEqual(a, b);
};

// Checks a submitted code against the user's current one of the given kind and uses it up.
// Returns an error message, or null when the code was good. Each guess is counted with an
// atomic update before comparing, so parallel requests can't get past MAX_OTP_ATTEMPTS, and
// the code is cleared atomically on success, so it works exactly once.
const consumeOtp = async (user, kind, submitted) => {
    const { code, expireAt, attempts } = OTP_FIELDS[kind];
    const stored = user[code];
    if (!stored || !['string', 'number'].includes(typeof submitted)) return CODE_WRONG;

    const sameCode = { _id: user._id, [code]: stored };
    const counted = await userModel.findOneAndUpdate(sameCode, { $inc: { [attempts]: 1 } }, { returnDocument: 'after' });
    if (!counted) return CODE_WRONG;

    const burn = () => userModel.updateOne(sameCode, { [code]: '', [expireAt]: 0 });
    if (counted[attempts] > MAX_OTP_ATTEMPTS) {
        await burn();
        return CODE_USED_UP;
    }
    if (!codesMatch(stored, submitted)) {
        if (counted[attempts] < MAX_OTP_ATTEMPTS) return CODE_WRONG;
        await burn();
        return CODE_USED_UP;
    }
    if (counted[expireAt] < Date.now()) return CODE_EXPIRED;

    const used = await userModel.updateOne(sameCode, { [code]: '', [expireAt]: 0, [attempts]: 0 });
    return used.modifiedCount === 1 ? null : CODE_WRONG;
};

// Saves a fresh code of the given kind on the user (and resets its wrong-guess count).
const setNewOtp = async (user, kind) => {
    const { code, expireAt, attempts } = OTP_FIELDS[kind];
    user[code] = generateOtp();
    user[expireAt] = Date.now() + OTP_LIFETIME_MS;
    user[attempts] = 0;
    await user.save();
    return user[code];
};

// Case-insensitive lookup so accounts saved with mixed-case emails (before normalization)
// still match the lowercase email Google returns.
const findUserByEmail = (email) => {
    const escaped = normalizeEmail(email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return userModel.findOne({ email: new RegExp(`^${escaped}$`, 'i') });
};

// Generates a fresh verification code, saves it, and emails it. Returns whether the email
// actually went out, so a mail failure doesn't undo an otherwise successful signup or login.
const issueVerifyOtp = async (user) => {
    const otp = await setNewOtp(user, 'verify');

    try {
        await sendVerifyEmailOtp(user.email, otp);
        return true;
    } catch (error) {
        console.error('Failed to send verification email:', error.message);
        return false;
    }
};

export const register = async (req, res) => {
    const { name, password, acceptedTerms } = req.body;
    const email = req.body.email ? normalizeEmail(req.body.email) : req.body.email;

    const validate = validateRegisterFields(name, email, password);
    if (!validate.isValid) {
        return res.json({ success: false, message: validate.message });
    }
    if (acceptedTerms !== true) {
        return res.json({ success: false, message: "Please agree to the Terms of Service and Privacy Policy to create an account." });
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
            password: hashedPassword,
            passwordSet: true,
            termsVersion: LEGAL_VERSION,
            termsAcceptedAt: new Date()
        });
        await user.save();

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '12h' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            maxAge: 12 * 60 * 60 * 1000
        });

        const otpSent = await issueVerifyOtp(user);

        return res.json({
            success: true,
            needsVerification: true,
            otpSent,
            message: otpSent
                ? "Account created. We've emailed you a 6-digit code to verify it."
                : "Account created, but we couldn't send the verification email. Tap Resend Code to try again."
        });
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

        // The cookie is still needed here: verify-email and send-verify-otp identify the user by it.
        if (!user.isAccountVerified) {
            const otpSent = await issueVerifyOtp(user);
            return res.json({
                success: true,
                needsVerification: true,
                otpSent,
                message: otpSent
                    ? "Please verify your email first. We've sent you a new 6-digit code."
                    : "Please verify your email first. We couldn't send a code just now, so tap Resend Code to try again."
            });
        }

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

        const otpSent = await issueVerifyOtp(user);
        if (!otpSent) {
            return res.json({ success: false, message: "We couldn't send the email just now. Please try again in a minute." });
        }

        return res.json({ success: true, message: 'OTP sent successfully.' })

    } catch (error) {
        serverError(res, 'Sending a verification code failed', error);
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
        const otpError = await consumeOtp(user, 'verify', otp);
        if (otpError) {
            return res.json({ success: false, message: otpError });
        }

        user.isAccountVerified = true;
        await user.save();

        // The account is already verified at this point, so a failed welcome email
        // shouldn't turn the response into an error.
        try {
            await sendWelcomeEmail(user.email);
        } catch (error) {
            console.error('Failed to send welcome email:', error.message);
        }

        return res.json({ success: true, message: 'Email verified successfully.' });

    } catch (error) {
        serverError(res, 'Verifying an email failed', error);
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
        
        const otp = await setNewOtp(user, 'reset');

        try {
            await sendPasswordResetEmail(user.email, otp);
        } catch (error) {
            console.error('Failed to send password reset email:', error.message);
            return res.json({ success: false, message: "We couldn't send the email just now. Please try again in a minute." });
        }

        return res.json({ success: true, message: 'OTP sent successfully.' });

    } catch (error) {
        serverError(res, 'Sending a password reset code failed', error);
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

        const otpError = await consumeOtp(user, 'reset', otp);
        if (otpError) {
            return res.json({ success: false, message: otpError });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        // The emailed code proves the user holds this address, so from now on the password is theirs,
        // including the first one on an account made with Google.
        user.passwordSet = true;
        await user.save();

        // The password is already changed, so a failed notice email shouldn't report an error.
        try {
            await sendPasswordResetSuccessEmail(user.email);
        } catch (error) {
            console.error('Failed to send password changed email:', error.message);
        }

        return res.json({ success: true, message: 'Password reset successfully.' });
    } catch (error) {
        serverError(res, 'Resetting a password failed', error);
    }
};
