import { describe, test, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../app.js';
import userModel from '../models/userModel.js';
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
afterEach(() => vi.restoreAllMocks());
afterAll(closeTestDB);

async function signedInAgent() {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload());
    return agent;
}

const cookieOf = (user) => `token=${jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET)}`;

describe('GET /api/user/data for the Me page', () => {
    test('sends no friends list and never the password hash', async () => {
        const agent = await signedInAgent();
        const res = await agent.get('/api/user/data');

        expect(res.body.success).toBe(true);
        expect(res.body.userData).not.toHaveProperty('friends');
        expect(res.body.userData).not.toHaveProperty('password');
        expect(JSON.stringify(res.body)).not.toContain((await userModel.findOne()).password);
    });

    test('hasPassword is true for an email account', async () => {
        const agent = await signedInAgent();
        const { userData } = (await agent.get('/api/user/data')).body;
        expect(userData.hasPassword).toBe(true);
    });

    test('hasPassword is false for a Google account, even though it stores a random hash', async () => {
        const user = await userModel.create({ name: 'Google Student', email: 'g@student.fatima.edu.ph', password: '$2a$10$randomhashforgoogleaccount', authProvider: 'google' });
        const res = await request(app).get('/api/user/data').set('Cookie', cookieOf(user));
        expect(res.body.userData.hasPassword).toBe(false);
    });

    test('updateProfile rejects a bad pace or time with a plain message, not a 500', async () => {
        const agent = await signedInAgent();
        for (const body of [{ wellbeingGoal: 'nope' }, { usualSleepStart: '25:99' }, { usualWakeTime: { a: 1 } }]) {
            const res = await agent.put('/api/user/profile').send(body);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(false);
        }
        const ok = await agent.put('/api/user/profile').send({ wellbeingGoal: 'catch-up', usualSleepStart: '22:30' });
        expect(ok.body.success).toBe(true);
    });

    test('termsAcceptedAt is set after accepting the terms', async () => {
        const agent = await signedInAgent();
        await userModel.updateOne({}, { termsVersion: '', termsAcceptedAt: null });
        expect((await agent.get('/api/user/data')).body.userData.termsAcceptedAt).toBeNull();

        await agent.post('/api/user/accept-terms');
        const { termsAcceptedAt } = (await agent.get('/api/user/data')).body.userData;
        expect(Number.isNaN(Date.parse(termsAcceptedAt))).toBe(false);
    });

    test('a database failure answers 500 with a plain message', async () => {
        const agent = await signedInAgent();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(userModel, 'findById').mockRejectedValueOnce(new Error('secret db detail'));

        const res = await agent.get('/api/user/data');
        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Something went wrong on our side. Try again in a moment.');
        expect(JSON.stringify(res.body)).not.toContain('secret db detail');
    });
});
