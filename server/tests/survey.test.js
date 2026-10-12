import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import userModel from '../models/userModel.js';
import { PSSResponse, WHOResponse } from '../models/Survey.js';
import { scorePSS, scoreWHO } from '../utils/surveyScoring.js';
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

const signUp = async (overrides = {}) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload(overrides));
    const me = await agent.get('/api/user/data');
    agent.id = me.body.userData._id;
    return agent;
};

describe('scoring', () => {
    test('PSS-10 adds the answers and reverses items 4, 5, 7 and 8', () => {
        expect(scorePSS([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(16);
        expect(scorePSS([4, 4, 4, 4, 4, 4, 4, 4, 4, 4])).toBe(24);
        expect(scorePSS([4, 4, 4, 0, 0, 4, 0, 0, 4, 4])).toBe(40);
        expect(scorePSS([2, 2, 2, 2, 2, 2, 2, 2, 2, 2])).toBe(20);
    });

    test('WHO-5 multiplies the raw total by 4', () => {
        expect(scoreWHO([0, 0, 0, 0, 0])).toBe(0);
        expect(scoreWHO([5, 5, 5, 5, 5])).toBe(100);
        expect(scoreWHO([3, 2, 4, 1, 3])).toBe(52);
    });

    test('bad answers score as null', () => {
        expect(scorePSS(undefined)).toBeNull();
        expect(scorePSS([1, 2, 3])).toBeNull();
        expect(scorePSS([0, 0, 0, 0, 0, 0, 0, 0, 0, 5])).toBeNull();
        expect(scorePSS([0, 0, 0, 0, 0, 0, 0, 0, 0, -1])).toBeNull();
        expect(scorePSS([0, 0, 0, 0, 0, 0, 0, 0, 0, 1.5])).toBeNull();
        expect(scorePSS(['1', 1, 1, 1, 1, 1, 1, 1, 1, 1])).toBeNull();
        expect(scoreWHO([0, 0, 0, 0, 6])).toBeNull();
        expect(scoreWHO([0, 0, 0, 0])).toBeNull();
        expect(scoreWHO('12345')).toBeNull();
    });
});

describe('POST /api/surveys/pss', () => {
    test('saves the score the server works out and ignores the one the browser sent', async () => {
        const alice = await signUp();
        const res = await alice.post('/api/surveys/pss').send({ score: 0, responses: [1, 2, 3, 1, 2, 3, 1, 2, 3, 1] });
        expect(res.status).toBe(200);
        // 1+2+3 + (4-1)+(4-2) + 3 + (4-1)+(4-2) + 3 + 1 = 6 + 5 + 3 + 5 + 3 + 1 = 23
        expect(res.body.score).toBe(23);

        const saved = await PSSResponse.findOne({ user: alice.id });
        expect(saved.score).toBe(23);
        const user = await userModel.findById(alice.id);
        expect(user.latestPSSScore).toBe(23);
        expect(user.lastPSSSubmission).toBeInstanceOf(Date);
    });

    test('rejects missing, short or out-of-range answers and saves nothing', async () => {
        const alice = await signUp();
        const bad = [
            {},
            { score: 20 },
            { score: 20, responses: [1, 2, 3] },
            { score: 20, responses: [0, 0, 0, 0, 0, 0, 0, 0, 0, 9] },
            { score: 20, responses: 'nope' },
        ];
        for (const body of bad) {
            const res = await alice.post('/api/surveys/pss').send(body);
            expect(res.status, JSON.stringify(body)).toBe(400);
        }
        expect(await PSSResponse.countDocuments()).toBe(0);
        const user = await userModel.findById(alice.id);
        expect(user.lastPSSSubmission).toBeFalsy();
    });

    test('needs a signed-in user', async () => {
        const res = await request(app).post('/api/surveys/pss').send({ responses: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
        expect(res.body.success).toBe(false);
        expect(await PSSResponse.countDocuments()).toBe(0);
    });
});

describe('POST /api/surveys/who', () => {
    test('saves the score the server works out', async () => {
        const alice = await signUp();
        const res = await alice.post('/api/surveys/who').send({ score: 100, responses: [3, 2, 4, 1, 3] });
        expect(res.status).toBe(200);
        expect(res.body.score).toBe(52);

        expect((await WHOResponse.findOne({ user: alice.id })).score).toBe(52);
        expect((await userModel.findById(alice.id)).latestWHOScore).toBe(52);
    });

    test('rejects bad answers', async () => {
        const alice = await signUp();
        for (const responses of [undefined, [1, 2], [0, 0, 0, 0, 6], [0, 0, 0, 0, -1]]) {
            const res = await alice.post('/api/surveys/who').send({ score: 50, responses });
            expect(res.status).toBe(400);
        }
        expect(await WHOResponse.countDocuments()).toBe(0);
    });
});

describe('GET /api/surveys/history', () => {
    test('returns the last 5 of each, newest first, only for the caller', async () => {
        const alice = await signUp();
        const bob = await signUp({ email: 'bob.student@student.fatima.edu.ph' });
        for (let i = 0; i < 7; i += 1) {
            await PSSResponse.create({ user: alice.id, score: i, responses: Array(10).fill(0), createdAt: new Date(2026, 0, i + 1) });
        }
        await WHOResponse.create({ user: alice.id, score: 60, responses: [3, 3, 3, 3, 3] });
        await PSSResponse.create({ user: bob.id, score: 39, responses: Array(10).fill(0) });

        const res = await alice.get('/api/surveys/history');
        expect(res.status).toBe(200);
        expect(res.body.pss.map((r) => r.score)).toEqual([6, 5, 4, 3, 2]);
        expect(res.body.pss[0]).not.toHaveProperty('responses');
        expect(res.body.who).toHaveLength(1);
    });

    test('needs a session', async () => {
        expect((await request(app).get('/api/surveys/history')).body.success).toBe(false);
    });
});
