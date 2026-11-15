import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import { PSSResponse, WHOResponse } from '../models/Survey.js';
import { CHECKIN_CONTEXTS, isCheckinContext } from '../utils/checkinContext.js';
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
    return agent;
};

const submitPSS = (agent) => agent.post('/api/surveys/pss').send({ responses: Array(10).fill(2) });
const submitWHO = (agent) => agent.post('/api/surveys/who').send({ responses: Array(5).fill(3) });
const tag = (agent, kind, id, context) => agent.patch(`/api/surveys/${kind}/${id}/context`).send({ context });
const userData = async (agent) => (await agent.get('/api/user/data')).body.userData;

describe('check-in context label', () => {
    test('the key list is the four labels', () => {
        expect(CHECKIN_CONTEXTS).toEqual(['deadlines', 'groupmates', 'money-family', 'health-sleep']);
        expect(isCheckinContext('deadlines')).toBe(true);
        expect(isCheckinContext('other')).toBe(false);
        expect(isCheckinContext(null)).toBe(false);
    });

    test('submitting answers the saved row id', async () => {
        const agent = await signUp();
        const pss = await submitPSS(agent);
        const who = await submitWHO(agent);
        expect(await PSSResponse.exists({ _id: pss.body.id })).toBeTruthy();
        expect(await WHOResponse.exists({ _id: who.body.id })).toBeTruthy();
    });

    test('PATCH sets, changes and clears the label, and history shows it', async () => {
        const agent = await signUp();
        const { body } = await submitPSS(agent);

        let res = await tag(agent, 'pss', body.id, 'deadlines');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true, context: 'deadlines' });
        expect((await agent.get('/api/surveys/history')).body.pss[0].context).toBe('deadlines');

        res = await tag(agent, 'pss', body.id, 'groupmates');
        expect(res.body.context).toBe('groupmates');

        res = await tag(agent, 'pss', body.id, null);
        expect(res.body.context).toBeNull();
        expect((await agent.get('/api/surveys/history')).body.pss[0].context).toBeNull();
        expect((await userData(agent)).checkInContext).toBeNull();
    });

    test('a bad or missing label answers 400', async () => {
        const agent = await signUp();
        const { body } = await submitPSS(agent);
        expect((await tag(agent, 'pss', body.id, 'exams')).status).toBe(400);
        expect((await tag(agent, 'pss', body.id, 5)).status).toBe(400);
        expect((await agent.patch(`/api/surveys/pss/${body.id}/context`).send({})).status).toBe(400);
        expect((await PSSResponse.findById(body.id)).context).toBeNull();
    });

    test('a bad id, an unknown row or kind=foo answers 404', async () => {
        const agent = await signUp();
        const { body } = await submitPSS(agent);
        expect((await tag(agent, 'pss', 'nope', 'deadlines')).status).toBe(404);
        expect((await tag(agent, 'pss', new mongoose.Types.ObjectId().toString(), 'deadlines')).status).toBe(404);
        expect((await tag(agent, 'foo', body.id, 'deadlines')).status).toBe(404);
        // a PSS id is not a WHO row
        expect((await tag(agent, 'who', body.id, 'deadlines')).status).toBe(404);
    });

    test("another user's row answers 404 and stays untouched", async () => {
        const owner = await signUp();
        const other = await signUp({ email: 'other@example.com' });
        const { body } = await submitPSS(owner);

        expect((await tag(other, 'pss', body.id, 'deadlines')).status).toBe(404);
        expect((await PSSResponse.findById(body.id)).context).toBeNull();
        expect((await userData(other)).checkInContext).toBeNull();
    });

    test('the score and answers never change', async () => {
        const agent = await signUp();
        const { body } = await submitPSS(agent);
        const before = (await PSSResponse.findById(body.id).lean());
        await tag(agent, 'pss', body.id, 'health-sleep');
        const after = (await PSSResponse.findById(body.id).lean());
        expect(after.score).toBe(before.score);
        expect(after.responses).toEqual(before.responses);
        expect((await userData(agent)).latestPSSScore).toBe(before.score);
    });

    test('the user field mirrors the newest tagged row across both kinds', async () => {
        const agent = await signUp();
        const older = await submitPSS(agent);
        const newer = await submitWHO(agent);
        await PSSResponse.updateOne({ _id: older.body.id }, { createdAt: new Date(Date.now() - 86400000) });

        await tag(agent, 'who', newer.body.id, 'money-family');
        await tag(agent, 'pss', older.body.id, 'deadlines');
        let me = await userData(agent);
        expect(me.checkInContext).toBe('money-family');
        expect(new Date(me.checkInContextAt).getTime()).toBe((await WHOResponse.findById(newer.body.id)).createdAt.getTime());

        await tag(agent, 'who', newer.body.id, null);
        me = await userData(agent);
        expect(me.checkInContext).toBe('deadlines');

        await tag(agent, 'pss', older.body.id, null);
        me = await userData(agent);
        expect(me.checkInContext).toBeNull();
        expect(me.checkInContextAt).toBeNull();
    });
});
