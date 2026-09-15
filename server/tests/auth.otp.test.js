import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import userModel from '../models/userModel.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';

// These flows send real emails via Brevo SMTP in production. Mock the whole
// module so tests never touch SMTP and never depend on server/.env existing.
vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
}));

import {
    sendWelcomeEmail,
    sendVerifyEmailOtp,
    sendPasswordResetEmail,
    sendPasswordResetSuccessEmail,
} from '../utils/emailService.js';

beforeAll(connectTestDB);
beforeEach(async () => {
    await clearTestDB();
    vi.clearAllMocks();
});
afterAll(closeTestDB);

describe('email verification flow', () => {
    const registerAndAuthenticate = async () => {
        const agent = request.agent(app);
        await agent.post('/api/auth/register').send(validRegisterPayload());
        return agent;
    };

    test('send-verify-otp and verify-email require authentication', async () => {
        const otpRes = await request(app).post('/api/auth/send-verify-otp').send({});
        const verifyRes = await request(app).post('/api/auth/verify-email').send({ otp: '123456' });

        expect(otpRes.body.success).toBe(false);
        expect(otpRes.body.message).toMatch(/unauthorized/i);
        expect(verifyRes.body.success).toBe(false);
        expect(verifyRes.body.message).toMatch(/unauthorized/i);
    });

    test('sends an OTP, then verifying with it marks the account verified and clears the OTP', async () => {
        const agent = await registerAndAuthenticate();

        const otpRes = await agent.post('/api/auth/send-verify-otp').send({});
        expect(otpRes.body.success).toBe(true);
        expect(sendVerifyEmailOtp).toHaveBeenCalledTimes(1);

        const user = await userModel.findOne({ email: 'test.student@student.fatima.edu.ph' });
        expect(user.verifyEmailOtp).toMatch(/^\d{6}$/);

        const verifyRes = await agent.post('/api/auth/verify-email').send({ otp: user.verifyEmailOtp });
        expect(verifyRes.body.success).toBe(true);
        expect(sendWelcomeEmail).toHaveBeenCalledTimes(1);

        const verifiedUser = await userModel.findById(user._id);
        expect(verifiedUser.isAccountVerified).toBe(true);
        expect(verifiedUser.verifyEmailOtp).toBe('');
    });

    test('rejects the wrong OTP', async () => {
        const agent = await registerAndAuthenticate();
        await agent.post('/api/auth/send-verify-otp').send({});

        const res = await agent.post('/api/auth/verify-email').send({ otp: '000000' });

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/invalid otp/i);
    });

    test('rejects an expired OTP', async () => {
        const agent = await registerAndAuthenticate();
        await agent.post('/api/auth/send-verify-otp').send({});

        const user = await userModel.findOne({ email: 'test.student@student.fatima.edu.ph' });
        user.verifyEmailOtpExpireAt = Date.now() - 1000; // already expired
        await user.save();

        const res = await agent.post('/api/auth/verify-email').send({ otp: user.verifyEmailOtp });

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/otp has expired/i);
    });

    test('rejects a new OTP request once the account is already verified', async () => {
        const agent = await registerAndAuthenticate();
        await agent.post('/api/auth/send-verify-otp').send({});
        const user = await userModel.findOne({ email: 'test.student@student.fatima.edu.ph' });
        await agent.post('/api/auth/verify-email').send({ otp: user.verifyEmailOtp });

        const res = await agent.post('/api/auth/send-verify-otp').send({});

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/already verified/i);
    });
});

describe('password reset flow', () => {
    const createLocalUser = async (password = 'Password123') => {
        const hashed = await bcrypt.hash(password, 10);
        return userModel.create({
            name: 'Test Student',
            email: 'test.student@student.fatima.edu.ph',
            password: hashed,
        });
    };

    test('rejects sending a reset OTP for an unregistered email', async () => {
        const res = await request(app).post('/api/auth/send-reset-otp').send({ email: 'nobody@student.fatima.edu.ph' });

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/user not found/i);
    });

    test('sends a reset OTP and resets the password with it', async () => {
        await createLocalUser();

        const otpRes = await request(app).post('/api/auth/send-reset-otp').send({ email: 'test.student@student.fatima.edu.ph' });
        expect(otpRes.body.success).toBe(true);
        expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);

        const user = await userModel.findOne({ email: 'test.student@student.fatima.edu.ph' });

        const resetRes = await request(app).post('/api/auth/reset-password').send({
            email: 'test.student@student.fatima.edu.ph',
            otp: user.resetPasswordOtp,
            password: 'NewPassword456',
        });
        expect(resetRes.body.success).toBe(true);
        expect(sendPasswordResetSuccessEmail).toHaveBeenCalledTimes(1);

        const updatedUser = await userModel.findById(user._id);
        expect(updatedUser.resetPasswordOtp).toBe('');
        const canLoginWithNewPassword = await bcrypt.compare('NewPassword456', updatedUser.password);
        expect(canLoginWithNewPassword).toBe(true);
    });

    test('rejects resetting with the wrong OTP', async () => {
        await createLocalUser();
        await request(app).post('/api/auth/send-reset-otp').send({ email: 'test.student@student.fatima.edu.ph' });

        const res = await request(app).post('/api/auth/reset-password').send({
            email: 'test.student@student.fatima.edu.ph',
            otp: '000000',
            password: 'NewPassword456',
        });

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/invalid otp/i);
    });

    test('rejects resetting with an expired OTP', async () => {
        await createLocalUser();
        await request(app).post('/api/auth/send-reset-otp').send({ email: 'test.student@student.fatima.edu.ph' });

        const user = await userModel.findOne({ email: 'test.student@student.fatima.edu.ph' });
        user.resetPasswordOtpExpireAt = Date.now() - 1000;
        await user.save();

        const res = await request(app).post('/api/auth/reset-password').send({
            email: 'test.student@student.fatima.edu.ph',
            otp: user.resetPasswordOtp,
            password: 'NewPassword456',
        });

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/otp has expired/i);
    });
});
