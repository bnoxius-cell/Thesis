import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import userModel from '../models/userModel.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';

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

describe('POST /api/auth/register', () => {
    test('rejects missing fields', async () => {
        const res = await request(app).post('/api/auth/register').send({ email: 'a@student.fatima.edu.ph' });

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/all fields must be filled/i);
    });

    test('rejects a malformed email', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send(validRegisterPayload({ email: 'not-an-email' }));

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/valid email/i);
    });

    test('accepts a non-Fatima email', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send(validRegisterPayload({ email: 'someone@gmail.com' }));

        expect(res.body.success).toBe(true);
        expect(await userModel.findOne({ email: 'someone@gmail.com' })).not.toBeNull();
    });

    test('rejects a password shorter than 8 characters', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send(validRegisterPayload({ password: 'short1' }));

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/at least 8 characters/i);
    });

    test('registers a new user, hashes the password, and sets an auth cookie', async () => {
        const res = await request(app).post('/api/auth/register').send(validRegisterPayload());

        expect(res.body.success).toBe(true);
        expect(res.headers['set-cookie']?.[0]).toMatch(/^token=/);

        const saved = await userModel.findOne({ email: 'test.student@student.fatima.edu.ph' });
        expect(saved).not.toBeNull();
        expect(saved.password).not.toBe('Password123'); // must be hashed, not plaintext
        expect(saved.isAccountVerified).toBe(false);
        expect(saved.profileTag).toBeTruthy(); // auto-assigned by the pre-save hook
    });

    test('normalizes email case: mixed-case input still matches on lookup', async () => {
        await request(app)
            .post('/api/auth/register')
            .send(validRegisterPayload({ email: 'Mixed.Case@Student.Fatima.Edu.PH' }));

        const saved = await userModel.findOne({ email: 'mixed.case@student.fatima.edu.ph' });
        expect(saved).not.toBeNull();
    });

    test('rejects registering an email that already exists locally', async () => {
        await request(app).post('/api/auth/register').send(validRegisterPayload());

        const res = await request(app).post('/api/auth/register').send(validRegisterPayload({ name: 'Someone Else' }));

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/email already exists/i);
    });

    test('rejects registering an email already tied to a Google account with a distinct message', async () => {
        await userModel.create({
            name: 'Google User',
            email: 'test.student@student.fatima.edu.ph',
            password: 'irrelevant-hash',
            authProvider: 'google',
        });

        const res = await request(app).post('/api/auth/register').send(validRegisterPayload());

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/already registered with google/i);
    });

    test('emails a verification code on signup and tells the client to verify', async () => {
        const res = await request(app).post('/api/auth/register').send(validRegisterPayload());

        expect(res.body.success).toBe(true);
        expect(res.body.needsVerification).toBe(true);
        expect(res.body.otpSent).toBe(true);

        const saved = await userModel.findOne({ email: 'test.student@student.fatima.edu.ph' });
        expect(saved.verifyEmailOtp).toMatch(/^\d{6}$/);
        expect(sendVerifyEmailOtp).toHaveBeenCalledTimes(1);
        expect(sendVerifyEmailOtp).toHaveBeenCalledWith('test.student@student.fatima.edu.ph', saved.verifyEmailOtp);
    });

    test('still creates the account when the verification email fails to send', async () => {
        sendVerifyEmailOtp.mockRejectedValueOnce(new Error('Connection timeout'));

        const res = await request(app).post('/api/auth/register').send(validRegisterPayload());

        expect(res.body.success).toBe(true);
        expect(res.body.needsVerification).toBe(true);
        expect(res.body.otpSent).toBe(false);
        expect(res.headers['set-cookie']?.[0]).toMatch(/^token=/); // so Resend Code still works

        const saved = await userModel.findOne({ email: 'test.student@student.fatima.edu.ph' });
        expect(saved).not.toBeNull();
    });
});
