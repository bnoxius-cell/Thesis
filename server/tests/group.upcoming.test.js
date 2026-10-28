import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';
import groupMessageModel from '../models/groupMessageModel.js';

vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(connectTestDB);
beforeEach(clearTestDB);
afterAll(closeTestDB);

const DAY = 24 * 60 * 60 * 1000;

const signUp = async (email, name) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email, name }));
    return agent;
};

const taskPayload = (overrides = {}) => ({
    title: 'ERD draft',
    course: 'IT 301',
    dueDate: '2030-01-15',
    hours: 2,
    difficulty: 3,
    importance: 4,
    ...overrides,
});

// alice owns the group, bob is a member, carol is an outsider.
const setup = async () => {
    const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
    const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
    const carol = await signUp('carol@student.fatima.edu.ph', 'Carol');
    const created = await alice.post('/api/groups').send({ name: 'Study Squad' });
    const group = created.body.group;
    await bob.post('/api/groups/join').send({ joinCode: group.joinCode });
    return { alice, bob, carol, group };
};

const shareTask = async (agent, groupId, overrides) => {
    const task = await agent.post('/api/tasks').send(taskPayload(overrides));
    const shared = await agent.post(`/api/groups/${groupId}/messages`).send({ taskId: task.body.task._id });
    return { task: task.body.task, message: shared.body.message };
};

describe('GET /api/groups/:id/upcoming', () => {
    test('only members can read it, and a bad id is a 404', async () => {
        const { carol, group } = await setup();
        const outsider = await carol.get(`/api/groups/${group._id}/upcoming`);
        expect(outsider.status).toBe(403);
        const bad = await carol.get('/api/groups/not-an-id/upcoming');
        expect(bad.status).toBe(404);
    });

    test('lists shared deadlines soonest first, with who shared them', async () => {
        const { alice, bob, group } = await setup();
        await shareTask(alice, group._id, { title: 'Later', dueDate: '2030-03-01' });
        await shareTask(bob, group._id, { title: 'Sooner', dueDate: '2030-02-01' });

        const res = await alice.get(`/api/groups/${group._id}/upcoming`);
        expect(res.body.success).toBe(true);
        expect(res.body.deadlines.map((d) => d.task.title)).toEqual(['Sooner', 'Later']);
        expect(res.body.deadlines[0].sharedBy.name).toBe('Bob');
        expect(res.body.deadlines[0].sharedAt).toBeTruthy();
    });

    test('leaves out tasks that were due more than a day ago', async () => {
        const { alice, group } = await setup();
        await shareTask(alice, group._id, { title: 'Old' });
        await shareTask(alice, group._id, { title: 'Fresh' });
        await groupMessageModel.updateOne({ 'task.title': 'Old' }, { 'task.dueDate': new Date(Date.now() - 3 * DAY) });
        await groupMessageModel.updateOne({ 'task.title': 'Fresh' }, { 'task.dueDate': new Date(Date.now() - 2 * 60 * 60 * 1000) });

        const res = await alice.get(`/api/groups/${group._id}/upcoming`);
        expect(res.body.deadlines.map((d) => d.task.title)).toEqual(['Fresh']);
    });

    test('the same task shared twice is listed once, from the newest message', async () => {
        const { alice, bob, group } = await setup();
        const { task, message: first } = await shareTask(alice, group._id);
        const again = await alice.post(`/api/groups/${group._id}/messages`).send({ taskId: task._id });

        const res = await bob.get(`/api/groups/${group._id}/upcoming`);
        expect(res.body.deadlines).toHaveLength(1);
        expect(res.body.deadlines[0]._id).toBe(again.body.message._id);
        expect(res.body.deadlines[0]._id).not.toBe(first._id);
    });

    test('addedByMe turns true once the member imports the task', async () => {
        const { alice, bob, group } = await setup();
        const { message } = await shareTask(alice, group._id);

        const before = await bob.get(`/api/groups/${group._id}/upcoming`);
        expect(before.body.deadlines[0].addedByMe).toBe(false);

        await bob.post('/api/tasks/import').send({ shareTag: message.task.shareTag });
        const after = await bob.get(`/api/groups/${group._id}/upcoming`);
        expect(after.body.deadlines[0].addedByMe).toBe(true);
    });

    test('only shows tasks from the group asked for', async () => {
        const { alice, group } = await setup();
        const other = await alice.post('/api/groups').send({ name: 'Other' });
        await shareTask(alice, other.body.group._id, { title: 'Elsewhere' });
        await shareTask(alice, group._id, { title: 'Here' });

        const res = await alice.get(`/api/groups/${group._id}/upcoming`);
        expect(res.body.deadlines.map((d) => d.task.title)).toEqual(['Here']);
    });
});

describe('pinned note', () => {
    test('an admin pins a note and members see who pinned it', async () => {
        const { alice, bob, group } = await setup();
        const res = await alice.patch(`/api/groups/${group._id}`).send({ pinned: '  Midterm review Friday 3pm  ' });
        expect(res.status).toBe(200);
        expect(res.body.group.pinned.text).toBe('Midterm review Friday 3pm');
        expect(res.body.group.pinned.by.name).toBe('Alice');
        expect(res.body.group.pinned.at).toBeTruthy();

        const list = await bob.get('/api/groups');
        expect(list.body.groups[0].pinned.text).toBe('Midterm review Friday 3pm');
    });

    test('a regular member cannot pin a note', async () => {
        const { bob, group } = await setup();
        const res = await bob.patch(`/api/groups/${group._id}`).send({ pinned: 'Hello' });
        expect(res.status).toBe(403);
    });

    test('an outsider cannot pin a note either', async () => {
        const { carol, group } = await setup();
        const res = await carol.patch(`/api/groups/${group._id}`).send({ pinned: 'Hello' });
        expect(res.status).toBe(403);
    });

    test('281 characters is refused and 280 is fine', async () => {
        const { alice, group } = await setup();
        const tooLong = await alice.patch(`/api/groups/${group._id}`).send({ pinned: 'a'.repeat(281) });
        expect(tooLong.status).toBe(400);
        const ok = await alice.patch(`/api/groups/${group._id}`).send({ pinned: 'a'.repeat(280) });
        expect(ok.status).toBe(200);
    });

    test('a note that is not text is refused', async () => {
        const { alice, group } = await setup();
        const res = await alice.patch(`/api/groups/${group._id}`).send({ pinned: { text: 'x' } });
        expect(res.status).toBe(400);
    });

    test('a family-friendly group refuses blocked words in the note', async () => {
        const { alice, group } = await setup();
        await alice.patch(`/api/groups/${group._id}`).send({ familyFriendly: true });
        const res = await alice.patch(`/api/groups/${group._id}`).send({ pinned: 'what the fuck' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('family_filter');
    });

    test('an empty note clears it', async () => {
        const { alice, group } = await setup();
        await alice.patch(`/api/groups/${group._id}`).send({ pinned: 'Bring laptops' });
        const res = await alice.patch(`/api/groups/${group._id}`).send({ pinned: '' });
        expect(res.status).toBe(200);
        expect(res.body.group.pinned.text).toBe('');
        expect(res.body.group.pinned.by).toBeFalsy();
    });

    test('saving other settings leaves the note alone', async () => {
        const { alice, group } = await setup();
        await alice.patch(`/api/groups/${group._id}`).send({ pinned: 'Bring laptops' });
        const res = await alice.patch(`/api/groups/${group._id}`).send({ name: 'Renamed' });
        expect(res.body.group.pinned.text).toBe('Bring laptops');
    });
});
