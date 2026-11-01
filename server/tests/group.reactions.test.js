import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';
import groupMessageModel from '../models/groupMessageModel.js';
import { isSingleEmoji } from '../utils/emoji.js';
import { hit, resetRateLimits } from '../utils/rateLimit.js';
import { pullUserReactions } from '../utils/chatCascade.js';

vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(connectTestDB);
beforeEach(async () => {
    await clearTestDB();
    resetRateLimits();
});
afterAll(closeTestDB);

const THUMBS_UP = '\u{1F44D}';
const HEART = '❤️';
const FAMILY = '\u{1F468}‍\u{1F469}‍\u{1F467}';
const THUMBS_UP_TONE = '\u{1F44D}\u{1F3FD}';

const signUp = async (email, name) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email, name }));
    const me = await agent.get('/api/user/data');
    agent.id = me.body.userData._id;
    return agent;
};

// alice owns the group and is its admin, bob and dave are regular members, carol is an outsider.
const setup = async () => {
    const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
    const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
    const carol = await signUp('carol@student.fatima.edu.ph', 'Carol');
    const dave = await signUp('dave@student.fatima.edu.ph', 'Dave');
    const created = await alice.post('/api/groups').send({ name: 'Study Squad' });
    const group = created.body.group;
    await bob.post('/api/groups/join').send({ joinCode: group.joinCode });
    await dave.post('/api/groups/join').send({ joinCode: group.joinCode });
    return { alice, bob, carol, dave, group };
};

const send = async (agent, group, text = 'hello') => {
    const res = await agent.post(`/api/groups/${group._id}/messages`).send({ text });
    return res.body.message;
};

const react = (agent, group, message, emoji, on = true) => agent
    .put(`/api/groups/${group._id}/messages/${message._id}/reactions`)
    .send({ emoji, on });

const remove = (agent, group, message) => agent.delete(`/api/groups/${group._id}/messages/${message._id}`);

const poll = (agent, group, after, since) => agent.get(`/api/groups/${group._id}/messages?after=${after}&since=${since}`);

describe('isSingleEmoji', () => {
    test('accepts one emoji, including skin tones and ZWJ sequences', () => {
        [THUMBS_UP, HEART, FAMILY, THUMBS_UP_TONE].forEach((emoji) => expect(isSingleEmoji(emoji), emoji).toBe(true));
    });

    test('refuses everything else', () => {
        ['a', '1', `${THUMBS_UP}${THUMBS_UP}`, '<b>', '', ' ', `${THUMBS_UP} `, 'x'.repeat(40), null, 5, undefined]
            .forEach((value) => expect(isSingleEmoji(value), String(value)).toBe(false));
    });
});

describe('rateLimit', () => {
    test('allows up to the limit inside a window, then reports when to retry', () => {
        const options = { limit: 2, windowMs: 1000 };
        expect(hit('a', options).ok).toBe(true);
        expect(hit('a', options).ok).toBe(true);
        const blocked = hit('a', options);
        expect(blocked.ok).toBe(false);
        expect(blocked.retryAfterMs).toBeGreaterThan(0);
        expect(hit('b', options).ok).toBe(true);
    });

    test('starts a fresh window once the old one has passed', () => {
        vi.useFakeTimers();
        try {
            const options = { limit: 1, windowMs: 1000 };
            expect(hit('c', options).ok).toBe(true);
            expect(hit('c', options).ok).toBe(false);
            vi.advanceTimersByTime(1001);
            expect(hit('c', options).ok).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('reacting to a message', () => {
    test('adding the same reaction twice leaves one id, removing twice is fine', async () => {
        const { alice, bob, group } = await setup();
        const message = await send(alice, group);

        await react(bob, group, message, THUMBS_UP);
        const again = await react(bob, group, message, THUMBS_UP);
        expect(again.status).toBe(200);
        expect(again.body.reactions).toEqual([{ emoji: THUMBS_UP, count: 1, userIds: [bob.id], mine: true }]);

        await react(bob, group, message, THUMBS_UP, false);
        const second = await react(bob, group, message, THUMBS_UP, false);
        expect(second.status).toBe(200);
        expect(second.body.reactions).toEqual([]);
        const stored = await groupMessageModel.findById(message._id).lean();
        expect(Object.keys(stored.reactions)).toEqual([]);
    });

    test('two people on one emoji count 2, and `mine` is per viewer', async () => {
        const { alice, bob, group } = await setup();
        const message = await send(alice, group);
        await react(alice, group, message, THUMBS_UP);
        await react(bob, group, message, THUMBS_UP);
        await react(bob, group, message, HEART);

        const asAlice = (await alice.get(`/api/groups/${group._id}/messages`)).body.messages[0].reactions;
        const asBob = (await bob.get(`/api/groups/${group._id}/messages`)).body.messages[0].reactions;

        expect(asAlice.map((r) => [r.emoji, r.count, r.mine])).toEqual([[THUMBS_UP, 2, true], [HEART, 1, false]]);
        expect(asBob.map((r) => [r.emoji, r.count, r.mine])).toEqual([[THUMBS_UP, 2, true], [HEART, 1, true]]);
        expect(asAlice[0].userIds.sort()).toEqual([alice.id, bob.id].sort());
    });

    test('family and skin tone emoji are accepted', async () => {
        const { alice, group } = await setup();
        const message = await send(alice, group);

        expect((await react(alice, group, message, FAMILY)).status).toBe(200);
        const res = await react(alice, group, message, THUMBS_UP_TONE);
        expect(res.body.reactions.map((r) => r.emoji)).toEqual([FAMILY, THUMBS_UP_TONE]);
    });

    test.each([['a'], [`${THUMBS_UP}${THUMBS_UP}`], ['<b>'], [''], ['x'.repeat(40)]])('%j is refused', async (emoji) => {
        const { alice, group } = await setup();
        const message = await send(alice, group);

        const res = await react(alice, group, message, emoji);
        expect(res.status).toBe(400);
        expect((await groupMessageModel.findById(message._id).lean()).reactions).toEqual({});
    });

    test('`on` must be a boolean', async () => {
        const { alice, group } = await setup();
        const message = await send(alice, group);

        const res = await alice.put(`/api/groups/${group._id}/messages/${message._id}/reactions`).send({ emoji: THUMBS_UP });
        expect(res.status).toBe(400);
    });

    test('a message takes 20 different emoji, not 21, and existing ones can still be used', async () => {
        const { alice, bob, group } = await setup();
        const message = await send(alice, group);
        const kinds = Array.from({ length: 21 }, (_, i) => String.fromCodePoint(0x1F600 + i));

        for (const emoji of kinds.slice(0, 20)) {
            expect((await react(alice, group, message, emoji)).status).toBe(200);
        }
        const over = await react(alice, group, message, kinds[20]);
        expect(over.status).toBe(400);

        const joinExisting = await react(bob, group, message, kinds[0]);
        expect(joinExisting.status).toBe(200);
        expect(joinExisting.body.reactions[0].count).toBe(2);
    });

    test('a deleted message cannot be reacted to', async () => {
        const { alice, group } = await setup();
        const message = await send(alice, group);
        await remove(alice, group, message);

        expect((await react(alice, group, message, THUMBS_UP)).status).toBe(404);
    });

    test('outsiders get 404 everywhere, and so do bad or foreign message ids', async () => {
        const { alice, carol, group } = await setup();
        const message = await send(alice, group);

        expect((await react(carol, group, message, THUMBS_UP)).status).toBe(404);
        expect((await remove(carol, group, message)).status).toBe(404);
        expect((await carol.get(`/api/groups/${group._id}/messages`)).status).toBe(404);
        expect((await carol.post(`/api/groups/${group._id}/messages`).send({ text: 'let me in' })).status).toBe(404);

        expect((await react(alice, group, { _id: 'not-an-id' }, THUMBS_UP)).status).toBe(404);
        expect((await remove(alice, group, { _id: 'not-an-id' })).status).toBe(404);

        const other = (await alice.post('/api/groups').send({ name: 'Other' })).body.group;
        const foreign = await send(alice, other);
        expect((await react(alice, group, foreign, THUMBS_UP)).status).toBe(404);
        expect((await remove(alice, group, foreign)).status).toBe(404);
    });

    test('121 reaction writes in a minute: the 121st is 429', async () => {
        const { alice, group } = await setup();
        const message = await send(alice, group);

        for (let i = 0; i < 120; i += 1) {
            expect((await react(alice, group, message, THUMBS_UP, i % 2 === 0)).status).toBe(200);
        }
        const res = await react(alice, group, message, THUMBS_UP);
        expect(res.status).toBe(429);
        expect(res.body.message).toBe('Slow down a little.');
    });
});

describe('deleting a message', () => {
    test('the sender can, and the next poll shows it as deleted with no text', async () => {
        const { alice, bob, group } = await setup();
        const old = await send(alice, group, 'secret');
        const newest = await send(bob, group, 'newer');
        const first = await poll(alice, group, newest._id, new Date(0).toISOString());
        const since = first.body.serverTime;

        const res = await remove(alice, group, old);
        expect(res.status).toBe(200);
        expect(res.body.message).toMatchObject({ _id: old._id, type: 'deleted', deleted: true, deletedByAdmin: false });
        expect(res.body.message.text).toBeUndefined();

        const next = await poll(bob, group, newest._id, since);
        expect(next.body.messages).toEqual([]);
        // Recent messages come back too (the poll overlaps by a few seconds); applying them twice is harmless.
        expect(next.body.changes.find((c) => c._id === old._id)).toEqual(
            { _id: old._id, reactions: [], deleted: true, type: 'deleted', deletedByAdmin: false }
        );

        const reload = (await bob.get(`/api/groups/${group._id}/messages`)).body.messages[0];
        expect(Object.keys(reload).sort()).toEqual(['_id', 'createdAt', 'deleted', 'deletedByAdmin', 'sender', 'type']);
    });

    test('a group admin can delete anyone, and it says so', async () => {
        const { alice, bob, group } = await setup();
        const message = await send(bob, group);

        const res = await remove(alice, group, message);
        expect(res.status).toBe(200);
        expect(res.body.message.deletedByAdmin).toBe(true);
    });

    test('an admin promoted by the owner can delete too', async () => {
        const { alice, bob, dave, group } = await setup();
        await alice.post(`/api/groups/${group._id}/admins`).send({ userId: dave.id });
        const message = await send(bob, group);

        expect((await remove(dave, group, message)).status).toBe(200);
    });

    test("a regular member can't delete someone else's message", async () => {
        const { alice, bob, group } = await setup();
        const message = await send(alice, group);

        const res = await remove(bob, group, message);
        expect(res.status).toBe(403);
        expect((await groupMessageModel.findById(message._id)).type).toBe('text');
    });

    test('deleting twice answers 200 both times', async () => {
        const { alice, group } = await setup();
        const message = await send(alice, group);

        expect((await remove(alice, group, message)).status).toBe(200);
        const again = await remove(alice, group, message);
        expect(again.status).toBe(200);
        expect(again.body.message.deleted).toBe(true);
    });

    test('deleting clears the snapshot and the reactions', async () => {
        const { alice, bob, group } = await setup();
        const created = await alice.post('/api/tasks').send({
            title: 'ERD draft', course: 'IT 301', dueDate: '2030-01-15', hours: 2, difficulty: 3, importance: 4,
        });
        const shared = (await alice.post(`/api/groups/${group._id}/messages`).send({ taskId: created.body.task._id })).body.message;
        await react(bob, group, shared, THUMBS_UP);

        await remove(alice, group, shared);

        const stored = await groupMessageModel.findById(shared._id).lean();
        expect(stored.type).toBe('deleted');
        expect(stored.task).toBeUndefined();
        expect(stored.text).toBe('');
        expect(stored.reactions).toEqual({});
        expect(stored.deletedAt).toBeTruthy();
    });

    test('a deleted task no longer shows in Upcoming', async () => {
        const { alice, group } = await setup();
        const created = await alice.post('/api/tasks').send({
            title: 'ERD draft', course: 'IT 301', dueDate: '2030-01-15', hours: 2, difficulty: 3, importance: 4,
        });
        const shared = (await alice.post(`/api/groups/${group._id}/messages`).send({ taskId: created.body.task._id })).body.message;
        expect((await alice.get(`/api/groups/${group._id}/upcoming`)).body.deadlines).toHaveLength(1);

        await remove(alice, group, shared);
        expect((await alice.get(`/api/groups/${group._id}/upcoming`)).body.deadlines).toEqual([]);
    });
});

describe('the poll change list', () => {
    test("a reaction on an old message shows up in `changes`, with the viewer's own `mine`", async () => {
        const { alice, bob, group } = await setup();
        const old = await send(alice, group, 'old');
        const newest = await send(alice, group, 'newest');
        const first = await poll(bob, group, newest._id, new Date(0).toISOString());
        expect(first.body.serverTime).toBeTruthy();

        await react(alice, group, old, THUMBS_UP);
        const next = await poll(bob, group, newest._id, first.body.serverTime);

        expect(next.body.messages).toEqual([]);
        const change = next.body.changes.find((c) => c._id === old._id);
        expect(change).toEqual({
            _id: old._id,
            reactions: [{ emoji: THUMBS_UP, count: 1, userIds: [alice.id], mine: false }],
            deleted: false,
        });
    });

    test('without `since` there are no changes, and a bad `since` is ignored', async () => {
        const { alice, group } = await setup();
        const message = await send(alice, group);
        await react(alice, group, message, THUMBS_UP);

        const plain = await alice.get(`/api/groups/${group._id}/messages?after=${message._id}`);
        expect(plain.body.changes).toBeUndefined();
        expect(plain.body.serverTime).toBeTruthy();

        const bad = await alice.get(`/api/groups/${group._id}/messages?after=${message._id}&since=yesterday`);
        expect(bad.status).toBe(200);
        expect(bad.body.changes).toBeUndefined();
    });

    test('messages newer than `after` come as messages, not as changes', async () => {
        const { alice, bob, group } = await setup();
        const first = await send(alice, group, 'one');
        await send(bob, group, 'two');

        const res = await poll(alice, group, first._id, new Date(0).toISOString());
        expect(res.body.messages.map((m) => m.text)).toEqual(['two']);
        expect(res.body.changes.map((c) => c._id)).toContain(first._id);
    });

    test('nothing older than the overlap is reported again', async () => {
        const { alice, group } = await setup();
        const message = await send(alice, group);
        await react(alice, group, message, THUMBS_UP);

        const later = new Date(Date.now() + 60 * 1000).toISOString();
        const res = await poll(alice, group, message._id, later);
        expect(res.body.changes).toEqual([]);
    });

    test('new messages carry an empty reaction list', async () => {
        const { alice, group } = await setup();
        const message = await send(alice, group);

        expect(message.reactions).toEqual([]);
    });
});

describe('pullUserReactions', () => {
    test('removes only that user and drops emoji left empty', async () => {
        const { alice, bob, group } = await setup();
        const message = await send(alice, group);
        await react(alice, group, message, THUMBS_UP);
        await react(bob, group, message, THUMBS_UP);
        await react(bob, group, message, HEART);

        await pullUserReactions(bob.id);

        const stored = (await groupMessageModel.findById(message._id).lean()).reactions;
        expect(Object.keys(stored)).toEqual([THUMBS_UP]);
        expect(stored[THUMBS_UP].map(String)).toEqual([alice.id]);
    });

    test('leaves messages without reactions alone', async () => {
        const { alice, bob, group } = await setup();
        const message = await send(alice, group);

        await pullUserReactions(bob.id);

        expect((await groupMessageModel.findById(message._id)).text).toBe('hello');
    });
});
