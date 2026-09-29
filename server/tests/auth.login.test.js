import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import userModel from '../models/userModel.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';

// Signup and login now email a verification code. Mock the whole module so tests
// never touch SMTP / the Brevo API and never depend on server/.env existing.
vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
}));

import { sendVerifyEmailOtp } from '../utils/emailService.js';

beforeAll(connectTestDB);
beforeEach(async () => {
    await clearTestDB();
    vi.clearAllMocks();
});
afterAll(closeTestDB);

const createLocalUser = async (password = 'Password123', { isAccountVerified = true } = {}) => {
    const hashed = await bcrypt.hash(password, 10);
    return userModel.create({
        name: 'Test Student',
        email: 'test.student@student.fatima.edu.ph',
        password: hashed,
        isAccountVerified,
    });
};

describe('POST /api/auth/login', () => {
    test('rejects a missing email', async () => {
        const res = await request(app).post('/api/auth/login').send({ password: 'Password123' });
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/email is required/i);
    });

    test('rejects a missing password', async () => {
        const res = await request(app).post('/api/auth/login').send({ email: 'test.student@student.fatima.edu.ph' });
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/password is required/i);
    });

    test('rejects an email that is not registered', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'nobody@student.fatima.edu.ph', password: 'Password123' });

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/user not found/i);
    });

    test('rejects the wrong password', async () => {
        await createLocalUser();

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test.student@student.fatima.edu.ph', password: 'WrongPassword1' });

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/incorrect password/i);
    });

    test('rejects a password attempt on a Google-only account with a distinct message', async () => {
        const hashed = await bcrypt.hash('random-generated-password', 10);
        await userModel.create({
            name: 'Google User',
            email: 'test.student@student.fatima.edu.ph',
            password: hashed,
            authProvider: 'google',
        });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test.student@student.fatima.edu.ph', password: 'WrongPassword1' });

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/google sign-in/i);
    });

    test('logs in with correct credentials and sets a cookie', async () => {
        await createLocalUser();

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test.student@student.fatima.edu.ph', password: 'Password123' });

        expect(res.body.success).toBe(true);
        expect(res.headers['set-cookie']?.[0]).toMatch(/^token=/);
        expect(res.body.needsVerification).toBeUndefined();
        expect(sendVerifyEmailOtp).not.toHaveBeenCalled();
    });

    test('an unverified account gets a fresh code on login and is told to verify', async () => {
        await createLocalUser('Password123', { isAccountVerified: false });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test.student@student.fatima.edu.ph', password: 'Password123' });

        expect(res.body.success).toBe(true);
        expect(res.body.needsVerification).toBe(true);
        expect(res.body.otpSent).toBe(true);
        expect(res.headers['set-cookie']?.[0]).toMatch(/^token=/);

        const user = await userModel.findOne({ email: 'test.student@student.fatima.edu.ph' });
        expect(user.verifyEmailOtp).toMatch(/^\d{6}$/);
        expect(sendVerifyEmailOtp).toHaveBeenCalledWith('test.student@student.fatima.edu.ph', user.verifyEmailOtp);
    });

    test('an unverified login still succeeds when the code email fails, flagged as not sent', async () => {
        await createLocalUser('Password123', { isAccountVerified: false });
        sendVerifyEmailOtp.mockRejectedValueOnce(new Error('Connection timeout'));

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test.student@student.fatima.edu.ph', password: 'Password123' });

        expect(res.body.success).toBe(true);
        expect(res.body.needsVerification).toBe(true);
        expect(res.body.otpSent).toBe(false);
    });

    test('login is case-insensitive on email', async () => {
        await createLocalUser();

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'Test.Student@Student.Fatima.Edu.PH', password: 'Password123' });

        expect(res.body.success).toBe(true);
    });

    test('rememberMe=true issues a longer-lived cookie than a normal login', async () => {
        await createLocalUser();

        const normal = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test.student@student.fatima.edu.ph', password: 'Password123' });
        const remembered = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test.student@student.fatima.edu.ph', password: 'Password123', rememberMe: true });

        const maxAge = (setCookieHeader) => Number(setCookieHeader.match(/Max-Age=(\d+)/i)?.[1]);

        expect(maxAge(remembered.headers['set-cookie'][0])).toBeGreaterThan(maxAge(normal.headers['set-cookie'][0]));
    });
});
