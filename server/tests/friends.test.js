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

const signUp = async (email, name) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email, name }));
    const me = await agent.get('/api/user/data');
    agent.id = me.body.userData._id;
    agent.tag = me.body.userData.profileTag;
    return agent;
};

const setup = async () => ({
    ana: await signUp('ana@student.fatima.edu.ph', 'Ana'),
    ben: await signUp('ben@student.fatima.edu.ph', 'Ben'),
    cara: await signUp('cara@student.fatima.edu.ph', 'Cara'),
});

describe('friend requests', () => {
    test('send, list as pending and sent, then accept', async () => {
        const { ana, ben } = await setup();
        const sent = await ana.post('/api/friends/request').send({ profileTag: ben.tag });
        expect(sent.body.success).toBe(true);

        const pending = await ben.get('/api/friends/pending');
        expect(pending.body.requests).toHaveLength(1);
        expect(pending.body.requests[0].user.name).toBe('Ana');
        expect(pending.body.requests[0].user.email).toBeUndefined();

        const mine = await ana.get('/api/friends/sent');
        expect(mine.body.requests).toHaveLength(1);
        expect(mine.body.requests[0].friend.name).toBe('Ben');
        expect(mine.body.requests[0].friend.email).toBeUndefined();

        const accepted = await ben.put(`/api/friends/accept/${pending.body.requests[0]._id}`);
        expect(accepted.body.success).toBe(true);

        const list = await ana.get('/api/friends');
        expect(list.body.friends).toHaveLength(1);
        expect(list.body.friends[0].name).toBe('Ben');
        expect(list.body.friends[0].email).toBeUndefined();
        expect((await ana.get('/api/friends/sent')).body.requests).toHaveLength(0);
    });

    test('the receiver can decline', async () => {
        const { ana, ben } = await setup();
        await ana.post('/api/friends/request').send({ profileTag: ben.tag });
        const [request1] = (await ben.get('/api/friends/pending')).body.requests;

        const res = await ben.delete(`/api/friends/request/${request1._id}`);
        expect(res.body.success).toBe(true);
        expect((await ben.get('/api/friends/pending')).body.requests).toHaveLength(0);
        expect((await ana.get('/api/friends/sent')).body.requests).toHaveLength(0);
    });

    test('the sender can cancel, and can ask again afterwards', async () => {
        const { ana, ben } = await setup();
        await ana.post('/api/friends/request').send({ profileTag: ben.tag });
        const [sentRequest] = (await ana.get('/api/friends/sent')).body.requests;

        const res = await ana.delete(`/api/friends/request/${sentRequest._id}`);
        expect(res.body.success).toBe(true);
        expect((await ben.get('/api/friends/pending')).body.requests).toHaveLength(0);

        const again = await ana.post('/api/friends/request').send({ profileTag: ben.tag });
        expect(again.body.success).toBe(true);
    });

    test('nobody else can decline or cancel it', async () => {
        const { ana, ben, cara } = await setup();
        await ana.post('/api/friends/request').send({ profileTag: ben.tag });
        const [request1] = (await ben.get('/api/friends/pending')).body.requests;

        const res = await cara.delete(`/api/friends/request/${request1._id}`);
        expect(res.status).toBe(404);
        expect((await ben.get('/api/friends/pending')).body.requests).toHaveLength(1);
    });

    test('an accepted friendship is not removed through the request route', async () => {
        const { ana, ben } = await setup();
        await ana.post('/api/friends/request').send({ profileTag: ben.tag });
        const [request1] = (await ben.get('/api/friends/pending')).body.requests;
        await ben.put(`/api/friends/accept/${request1._id}`);

        const res = await ana.delete(`/api/friends/request/${request1._id}`);
        expect(res.status).toBe(404);
        expect((await ana.get('/api/friends')).body.friends).toHaveLength(1);
    });

    test('asking someone who already asked you makes you friends', async () => {
        const { ana, ben } = await setup();
        await ana.post('/api/friends/request').send({ profileTag: ben.tag });

        const back = await ben.post('/api/friends/request').send({ profileTag: ana.tag });
        expect(back.body.success).toBe(true);
        expect(back.body.accepted).toBe(true);
        expect((await ana.get('/api/friends')).body.friends).toHaveLength(1);
        expect((await ben.get('/api/friends/pending')).body.requests).toHaveLength(0);

        const notices = await ana.get('/api/notifications');
        expect(notices.body.notifications.some((n) => n.type === 'friend_accepted')).toBe(true);
    });

    test('asking twice, asking yourself and unknown people are refused', async () => {
        const { ana, ben } = await setup();
        await ana.post('/api/friends/request').send({ profileTag: ben.tag });
        expect((await ana.post('/api/friends/request').send({ profileTag: ben.tag })).status).toBe(400);
        expect((await ana.post('/api/friends/request').send({ profileTag: ana.tag })).status).toBe(400);
        expect((await ana.post('/api/friends/request').send({ profileTag: 'NOPE00' })).status).toBe(404);
        expect((await ana.post('/api/friends/request').send({ userId: 'not-an-id' })).status).toBe(404);
    });

    test('bad ids answer 404', async () => {
        const { ana } = await setup();
        expect((await ana.delete('/api/friends/request/nope')).status).toBe(404);
        expect((await ana.put('/api/friends/accept/nope')).status).toBe(404);
        expect((await ana.delete('/api/friends/nope')).status).toBe(404);
    });

    test('a friend can be removed', async () => {
        const { ana, ben } = await setup();
        await ana.post('/api/friends/request').send({ profileTag: ben.tag });
        const [request1] = (await ben.get('/api/friends/pending')).body.requests;
        await ben.put(`/api/friends/accept/${request1._id}`);

        const res = await ana.delete(`/api/friends/${ben.id}`);
        expect(res.body.success).toBe(true);
        expect((await ben.get('/api/friends')).body.friends).toHaveLength(0);
    });
});
