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
    return agent;
};

const taskPayload = (overrides = {}) => ({
    title: 'Chapter 4 problem set',
    course: 'MATH 201',
    dueDate: '2030-01-15',
    hours: 2,
    difficulty: 3,
    importance: 4,
    ...overrides,
});

// alice owns the group, bob has joined it with the join code, carol is an outsider.
const setup = async () => {
    const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
    const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
    const carol = await signUp('carol@student.fatima.edu.ph', 'Carol');

    const created = await alice.post('/api/groups').send({ name: 'Study Squad' });
    const group = created.body.group;
    await bob.post('/api/groups/join').send({ joinCode: group.joinCode });

    return { alice, bob, carol, group };
};

describe('groups with join codes', () => {
    test('creating a group returns a 6 character join code', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const res = await alice.post('/api/groups').send({ name: 'Study Squad' });

        expect(res.body.success).toBe(true);
        expect(res.body.group.joinCode).toMatch(/^[A-Z2-9]{6}$/);
    });

    test('a group needs a name', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const res = await alice.post('/api/groups').send({ name: '   ' });

        expect(res.body.success).toBe(false);
    });

    test('joining works with the code, in any letter case', async () => {
        const { carol, group } = await setup();
        const res = await carol.post('/api/groups/join').send({ joinCode: group.joinCode.toLowerCase() });

        expect(res.body.success).toBe(true);
    });

    test('a wrong code is rejected', async () => {
        const { carol } = await setup();
        const res = await carol.post('/api/groups/join').send({ joinCode: 'ZZZZZZ' });

        expect(res.body.success).toBe(false);
    });
});

describe('group messages', () => {
    test('members can send and read messages, oldest first', async () => {
        const { alice, bob, group } = await setup();

        await alice.post(`/api/groups/${group._id}/messages`).send({ text: 'hello' });
        await bob.post(`/api/groups/${group._id}/messages`).send({ text: 'hi alice' });

        const res = await bob.get(`/api/groups/${group._id}/messages`);
        expect(res.body.success).toBe(true);
        expect(res.body.messages.map((m) => m.text)).toEqual(['hello', 'hi alice']);
        expect(res.body.messages[0].sender.name).toBe('Alice');
    });

    test('?after= only returns newer messages', async () => {
        const { alice, group } = await setup();
        const first = await alice.post(`/api/groups/${group._id}/messages`).send({ text: 'one' });
        await alice.post(`/api/groups/${group._id}/messages`).send({ text: 'two' });

        const res = await alice.get(`/api/groups/${group._id}/messages?after=${first.body.message._id}`);
        expect(res.body.messages.map((m) => m.text)).toEqual(['two']);
    });

    test('non-members cannot read or send', async () => {
        const { carol, group } = await setup();

        const read = await carol.get(`/api/groups/${group._id}/messages`);
        const send = await carol.post(`/api/groups/${group._id}/messages`).send({ text: 'let me in' });

        expect(read.status).toBe(403);
        expect(send.status).toBe(403);
    });

    test('empty and oversized messages are rejected', async () => {
        const { alice, group } = await setup();

        const empty = await alice.post(`/api/groups/${group._id}/messages`).send({ text: '   ' });
        const huge = await alice.post(`/api/groups/${group._id}/messages`).send({ text: 'a'.repeat(1001) });

        expect(empty.status).toBe(400);
        expect(huge.status).toBe(400);
    });

    test('unknown or malformed group ids return 404', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const res = await alice.get('/api/groups/not-an-id/messages');

        expect(res.status).toBe(404);
    });

    test('emoji survive the round trip', async () => {
        const { alice, group } = await setup();
        await alice.post(`/api/groups/${group._id}/messages`).send({ text: 'nice 👍🎉' });

        const res = await alice.get(`/api/groups/${group._id}/messages`);
        expect(res.body.messages[0].text).toBe('nice 👍🎉');
    });

    test('deleting the group removes its messages', async () => {
        const { alice, group } = await setup();
        await alice.post(`/api/groups/${group._id}/messages`).send({ text: 'bye' });

        await alice.delete(`/api/groups/${group._id}`);
        const { default: groupMessageModel } = await import('../models/groupMessageModel.js');

        expect(await groupMessageModel.countDocuments({ group: group._id })).toBe(0);
    });
});

describe('sharing tasks in a group chat', () => {
    const shareTask = async (alice, group) => {
        const created = await alice.post('/api/tasks').send(taskPayload());
        const taskId = created.body.task._id;
        const res = await alice.post(`/api/groups/${group._id}/messages`).send({ taskId });
        return { taskId, res };
    };

    test('a member can share one of their tasks', async () => {
        const { alice, group } = await setup();
        const { res } = await shareTask(alice, group);

        expect(res.body.success).toBe(true);
        expect(res.body.message.type).toBe('task');
        expect(res.body.message.task.title).toBe('Chapter 4 problem set');
        expect(res.body.message.task.shareTag).toMatch(/^\d{6}$/);
        // The sender already has it.
        expect(res.body.message.addedByMe).toBe(true);
    });

    test("you can't share a task that isn't yours", async () => {
        const { alice, bob, group } = await setup();
        const created = await alice.post('/api/tasks').send(taskPayload());

        const res = await bob.post(`/api/groups/${group._id}/messages`).send({ taskId: created.body.task._id });
        expect(res.status).toBe(404);
    });

    test("a teammate sees it as not added, then as added after importing it", async () => {
        const { alice, bob, group } = await setup();
        const { res: shared } = await shareTask(alice, group);

        const before = await bob.get(`/api/groups/${group._id}/messages`);
        expect(before.body.messages[0].addedByMe).toBe(false);

        const imported = await bob.post('/api/tasks/import').send({ shareTag: shared.body.message.task.shareTag });
        expect(imported.body.success).toBe(true);
        expect(imported.body.task.title).toBe('Chapter 4 problem set');

        const after = await bob.get(`/api/groups/${group._id}/messages`);
        expect(after.body.messages[0].addedByMe).toBe(true);
    });
});
