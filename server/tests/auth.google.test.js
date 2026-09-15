import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';

// Mock our local wrapper around google-auth-library rather than the package
// itself — it's a project file, so Vitest never externalizes it, which makes
// the mock reliably apply everywhere authController.js reaches it.
vi.mock('../utils/googleAuth.js', () => ({
    verifyGoogleIdToken: vi.fn(),
}));

import { verifyGoogleIdToken } from '../utils/googleAuth.js';
import app from '../app.js';
import userModel from '../models/userModel.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';

const mockGooglePayload = (overrides = {}) => ({
    getPayload: () => ({
        name: 'Test Student',
        sub: 'google-id-123',
        picture: 'https://example.com/avatar.png',
        email_verified: true,
        email: 'test.student@student.fatima.edu.ph',
        ...overrides,
    }),
});

beforeAll(connectTestDB);
beforeEach(async () => {
    await clearTestDB();
    verifyGoogleIdToken.mockReset();
});
afterAll(closeTestDB);

describe('POST /api/auth/google', () => {
    test('rejects a missing token', async () => {
        const res = await request(app).post('/api/auth/google').send({});

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/missing google token/i);
    });

    test('rejects an invalid/expired Google token', async () => {
        verifyGoogleIdToken.mockRejectedValue(new Error('Token used too late'));

        const res = await request(app).post('/api/auth/google').send({ token: 'bad-token' });

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/google authentication failed/i);
    });

    test('rejects an unverified Google email', async () => {
        verifyGoogleIdToken.mockResolvedValue(mockGooglePayload({ email_verified: false }));

        const res = await request(app).post('/api/auth/google').send({ token: 'valid-token' });

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/not verified/i);
    });

    test('rejects a verified Google email outside the Fatima student domain', async () => {
        verifyGoogleIdToken.mockResolvedValue(mockGooglePayload({ email: 'test.student@gmail.com' }));

        const res = await request(app).post('/api/auth/google').send({ token: 'valid-token' });

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/fatima student email/i);
    });

    test('creates a new verified user on first-time Google login', async () => {
        verifyGoogleIdToken.mockResolvedValue(mockGooglePayload());

        const res = await request(app).post('/api/auth/google').send({ token: 'valid-token' });

        expect(res.body.success).toBe(true);
        expect(res.headers['set-cookie']?.[0]).toMatch(/^token=/);

        const user = await userModel.findOne({ email: 'test.student@student.fatima.edu.ph' });
        expect(user).not.toBeNull();
        expect(user.authProvider).toBe('google');
        expect(user.isAccountVerified).toBe(true);
        expect(user.googleId).toBe('google-id-123');
    });

    test('links Google to an existing local account instead of creating a duplicate', async () => {
        const hashed = await bcrypt.hash('Password123', 10);
        const existing = await userModel.create({
            name: 'Test Student',
            email: 'test.student@student.fatima.edu.ph',
            password: hashed,
            authProvider: 'local',
        });

        verifyGoogleIdToken.mockResolvedValue(mockGooglePayload());

        const res = await request(app).post('/api/auth/google').send({ token: 'valid-token' });

        expect(res.body.success).toBe(true);

        const matchingUsers = await userModel.find({ email: 'test.student@student.fatima.edu.ph' });
        expect(matchingUsers).toHaveLength(1); // no duplicate account created

        const linked = await userModel.findById(existing._id);
        expect(linked.googleId).toBe('google-id-123');
        expect(linked.isAccountVerified).toBe(true);
        expect(linked.authProvider).toBe('local'); // provider label is untouched, identity is just linked
    });
});
