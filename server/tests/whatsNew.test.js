import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
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

async function signedInAgent() {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload());
    return agent;
}

describe('POST /api/user/notes-seen', () => {
    test('needs a sign-in', async () => {
        const res = await request(app).post('/api/user/notes-seen').send({ version: '2026-11-14' });
        expect(res.body.success).toBe(false);
    });

    test.each([
        ['missing', {}],
        ['not a string', { version: 20261114 }],
        ['malformed', { version: 'nope' }],
        ['wrong shape', { version: '2026-1-14' }],
    ])('answers 400 for a %s version', async (_name, body) => {
        const agent = await signedInAgent();
        const res = await agent.post('/api/user/notes-seen').send(body);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    test('saves the version and user data returns it', async () => {
        const agent = await signedInAgent();
        const res = await agent.post('/api/user/notes-seen').send({ version: '2026-11-14-2' });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true, seenNotesVersion: '2026-11-14-2' });

        const data = await agent.get('/api/user/data');
        expect(data.body.userData.seenNotesVersion).toBe('2026-11-14-2');
    });

    test('a new account starts with nothing seen', async () => {
        const agent = await signedInAgent();
        const data = await agent.get('/api/user/data');
        expect(data.body.userData.seenNotesVersion).toBe('');
    });
});
