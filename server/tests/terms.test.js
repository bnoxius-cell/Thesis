import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import userModel from '../models/userModel.js';
import { LEGAL_VERSION } from '../utils/legal.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';

vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(connectTestDB);
beforeEach(clearTestDB);
afterAll(closeTestDB);

describe('accepting the terms after signing in', () => {
    test('a user with no accepted version is flagged, and accepting clears it', async () => {
        const agent = request.agent(app);
        await agent.post('/api/auth/register').send(validRegisterPayload());
        // Simulates an account made before the terms existed (or via Google sign-in).
        await userModel.updateOne({}, { termsVersion: '', termsAcceptedAt: null });

        const before = (await agent.get('/api/user/data')).body.userData;
        expect(before.termsVersion).toBe('');
        expect(before.currentLegalVersion).toBe(LEGAL_VERSION);

        const res = await agent.post('/api/user/accept-terms');
        expect(res.body).toMatchObject({ success: true, termsVersion: LEGAL_VERSION });

        const after = (await agent.get('/api/user/data')).body.userData;
        expect(after.termsVersion).toBe(after.currentLegalVersion);
        expect((await userModel.findOne()).termsAcceptedAt).toBeInstanceOf(Date);
    });

    test('needs a signed-in user', async () => {
        const res = await request(app).post('/api/user/accept-terms');
        expect(res.body.success).toBe(false);
    });
});
