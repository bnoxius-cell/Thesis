import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import groupTaskModel from '../models/groupTaskModel.js';
import notificationModel from '../models/notificationModel.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';
import { resetRateLimits } from '../utils/rateLimit.js';
import { seen, present, resetPresence, PRESENCE_FRESH_MS } from '../utils/presence.js';

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
    resetPresence();
});
afterAll(closeTestDB);

const signUp = async (email, name) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email, name }));
    const me = await agent.get('/api/user/data');
    agent.id = me.body.userData._id;
    return agent;
};

// alice owns the group, ann is an admin, bob is a member, carol is an outsider.
const setup = async () => {
    const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
    const ann = await signUp('ann@student.fatima.edu.ph', 'Ann');
    const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
    const carol = await signUp('carol@student.fatima.edu.ph', 'Carol');

    const { group } = (await alice.post('/api/groups').send({ name: 'Study Squad' })).body;
    await ann.post('/api/groups/join').send({ joinCode: group.joinCode });
    await bob.post('/api/groups/join').send({ joinCode: group.joinCode });
    await alice.post(`/api/groups/${group._id}/admins`).send({ userId: ann.id });
    return { alice, ann, bob, carol, group };
};

const DUE = '2026-12-01T10:00:00.000Z';
const NEW_DUE = '2026-12-05T10:00:00.000Z';
const newTask = (overrides = {}) => ({ title: 'Lab report', course: 'Web Systems', dueDate: DUE, hours: 2, ...overrides });

const plan = (agent, group) => agent.get(`/api/groups/${group._id}/plan`);
const stamp = (agent, group, editing) => agent.get(`/api/groups/${group._id}/plan/stamp`).query(editing ? { editing } : {});
const create = (agent, group, body = newTask()) => agent.post(`/api/groups/${group._id}/tasks`).send(body);
const edit = (agent, group, taskId, changes, expected) => agent.patch(`/api/groups/${group._id}/tasks/${taskId}`).send({ changes, expected });
const remove = (agent, group, taskId) => agent.delete(`/api/groups/${group._id}/tasks/${taskId}`);

const planAt = async (agent, group) => (await stamp(agent, group)).body.planAt;

describe('group plan roles', () => {
    test('the owner adds a task, an admin sees and edits it, the owner sees the edit', async () => {
        const { alice, ann, group } = await setup();
        const created = await create(alice, group);
        expect(created.status).toBe(201);
        expect(created.body.task).toMatchObject({ title: 'Lab report', course: 'Web Systems', hours: 2, isCompleted: false });
        expect(created.body.task.createdBy.name).toBe('Alice');

        const annView = await plan(ann, group);
        expect(annView.status).toBe(200);
        expect(annView.body.role).toBe('editor');
        expect(annView.body.tasks.map((t) => t.title)).toEqual(['Lab report']);

        const taskId = created.body.task._id;
        const renamed = await edit(ann, group, taskId, { title: 'Lab report 2' }, { title: 'Lab report' });
        expect(renamed.status).toBe(200);
        expect(renamed.body.task.title).toBe('Lab report 2');
        expect(renamed.body.task.updatedBy.name).toBe('Ann');

        expect((await plan(alice, group)).body.tasks[0].title).toBe('Lab report 2');
    });

    test('a member can view but not add, edit or delete', async () => {
        const { alice, bob, group } = await setup();
        const taskId = (await create(alice, group)).body.task._id;

        const view = await plan(bob, group);
        expect(view.status).toBe(200);
        expect(view.body.role).toBe('viewer');
        expect(view.body.tasks).toHaveLength(1);

        const refused = [
            await create(bob, group),
            await edit(bob, group, taskId, { title: 'Mine now' }, { title: 'Lab report' }),
            await remove(bob, group, taskId),
        ];
        refused.forEach((res) => {
            expect(res.status).toBe(403);
            expect(res.body.message).toBe("Only admins can change this group's plan.");
        });
        expect((await plan(alice, group)).body.tasks[0].title).toBe('Lab report');
    });

    test('a member promoted to admin can edit, and demoted again cannot', async () => {
        const { alice, bob, group } = await setup();
        const taskId = (await create(alice, group)).body.task._id;

        await alice.post(`/api/groups/${group._id}/admins`).send({ userId: bob.id });
        expect((await edit(bob, group, taskId, { hours: 4 }, { hours: 2 })).status).toBe(200);

        await alice.delete(`/api/groups/${group._id}/admins/${bob.id}`);
        expect((await edit(bob, group, taskId, { hours: 5 }, { hours: 4 })).status).toBe(403);
        expect((await plan(bob, group)).body.role).toBe('viewer');
    });

    test('an outsider gets 404 on every plan route', async () => {
        const { alice, carol, group } = await setup();
        const taskId = (await create(alice, group)).body.task._id;

        const answers = [
            await plan(carol, group),
            await stamp(carol, group),
            await create(carol, group),
            await edit(carol, group, taskId, { title: 'x' }, { title: 'Lab report' }),
            await remove(carol, group, taskId),
        ];
        answers.forEach((res) => expect(res.status).toBe(404));
    });

    test('a task from another group is 404', async () => {
        const { alice, group } = await setup();
        const { group: other } = (await alice.post('/api/groups').send({ name: 'Other' })).body;
        const foreignId = (await create(alice, other)).body.task._id;

        expect((await edit(alice, group, foreignId, { title: 'Moved' }, { title: 'Lab report' })).status).toBe(404);
        expect((await remove(alice, group, foreignId)).status).toBe(404);
        expect((await remove(alice, group, 'not-an-id')).status).toBe(404);
        expect((await groupTaskModel.findById(foreignId)).title).toBe('Lab report');
    });
});

describe('group task edits', () => {
    test('two admins changing different fields from the same start both keep their edits', async () => {
        const { alice, ann, group } = await setup();
        const taskId = (await create(alice, group)).body.task._id;

        const [byAlice, byAnn] = await Promise.all([
            edit(alice, group, taskId, { title: 'Final lab report' }, { title: 'Lab report' }),
            edit(ann, group, taskId, { dueDate: NEW_DUE }, { dueDate: DUE }),
        ]);
        expect(byAlice.status).toBe(200);
        expect(byAnn.status).toBe(200);

        const stored = await groupTaskModel.findById(taskId);
        expect(stored.title).toBe('Final lab report');
        expect(stored.dueDate.toISOString()).toBe(NEW_DUE);
    });

    test('two admins changing the same field: the second gets 409 with the current task', async () => {
        const { alice, ann, group } = await setup();
        const taskId = (await create(alice, group)).body.task._id;

        expect((await edit(alice, group, taskId, { title: 'From Alice' }, { title: 'Lab report' })).status).toBe(200);
        const second = await edit(ann, group, taskId, { title: 'From Ann' }, { title: 'Lab report' });
        expect(second.status).toBe(409);
        expect(second.body.conflicts).toEqual(['title']);
        expect(second.body.task.title).toBe('From Alice');
        expect(second.body.task.updatedBy.name).toBe('Alice');
        expect((await groupTaskModel.findById(taskId)).title).toBe('From Alice');
    });

    test('a conflict on one field stops the whole edit', async () => {
        const { alice, ann, group } = await setup();
        const taskId = (await create(alice, group)).body.task._id;

        await edit(alice, group, taskId, { title: 'From Alice' }, { title: 'Lab report' });
        const second = await edit(ann, group, taskId, { title: 'From Ann', hours: 6 }, { title: 'Lab report', hours: 2 });
        expect(second.status).toBe(409);
        expect(second.body.conflicts).toEqual(['title']);
        expect((await groupTaskModel.findById(taskId)).hours).toBe(2);
    });

    test('both marking a task done is fine, and the first one is kept as who did it', async () => {
        const { alice, ann, group } = await setup();
        const taskId = (await create(alice, group)).body.task._id;

        const first = await edit(alice, group, taskId, { isCompleted: true }, { isCompleted: false });
        expect(first.status).toBe(200);
        expect(first.body.task.completedBy.name).toBe('Alice');
        expect(first.body.task.completedAt).toBeTruthy();

        const second = await edit(ann, group, taskId, { isCompleted: true }, { isCompleted: false });
        expect(second.status).toBe(200);
        expect(second.body.task.completedBy.name).toBe('Alice');

        const reopened = await edit(ann, group, taskId, { isCompleted: false }, { isCompleted: true });
        expect(reopened.body.task.completedBy).toBeNull();
        expect(reopened.body.task.completedAt).toBeNull();
    });

    test('completedAt and completedBy are set by the server only', async () => {
        const { alice, group } = await setup();
        const taskId = (await create(alice, group)).body.task._id;

        const sneaky = await edit(alice, group, taskId, { completedBy: alice.id }, { completedBy: null });
        expect(sneaky.status).toBe(400);
        expect((await groupTaskModel.findById(taskId)).completedBy).toBeNull();
    });

    test('expected must hold exactly the changed fields, as plain values', async () => {
        const { alice, group } = await setup();
        const taskId = (await create(alice, group)).body.task._id;

        const refused = [
            await edit(alice, group, taskId, { title: 'New' }, {}),
            await edit(alice, group, taskId, { title: 'New' }, { title: 'Lab report', hours: 2 }),
            await edit(alice, group, taskId, { title: 'New' }, { title: { $ne: 'x' } }),
            await edit(alice, group, taskId, { title: 'New', group: 'x' }, { title: 'Lab report', group: 'x' }),
            await edit(alice, group, taskId, { hours: 3 }, { hours: '2' }),
            await edit(alice, group, taskId, { title: '' }, { title: 'Lab report' }),
            await edit(alice, group, taskId, {}, {}),
            await alice.patch(`/api/groups/${group._id}/tasks/${taskId}`).send({ title: 'New' }),
        ];
        refused.forEach((res) => expect(res.status).toBe(400));
        expect((await groupTaskModel.findById(taskId)).title).toBe('Lab report');
    });

    test('a due date is compared as a date, whatever the string looks like', async () => {
        const { alice, group } = await setup();
        const taskId = (await create(alice, group)).body.task._id;

        const res = await edit(alice, group, taskId, { dueDate: NEW_DUE }, { dueDate: '2026-12-01T18:00:00+08:00' });
        expect(res.status).toBe(200);
        expect(res.body.task.dueDate).toBe(NEW_DUE);
    });

    test('editing a deleted task is 404', async () => {
        const { alice, ann, group } = await setup();
        const taskId = (await create(alice, group)).body.task._id;

        expect((await remove(ann, group, taskId)).status).toBe(200);
        expect((await edit(alice, group, taskId, { title: 'Too late' }, { title: 'Lab report' })).status).toBe(404);
        expect((await remove(ann, group, taskId)).status).toBe(404);
    });
});

describe('group task limits', () => {
    test('bad fields are refused', async () => {
        const { alice, group } = await setup();
        expect((await create(alice, group, newTask({ title: '' }))).status).toBe(400);
        expect((await create(alice, group, newTask({ hours: 99 }))).status).toBe(400);
        expect((await create(alice, group, newTask({ dueDate: 'soon' }))).status).toBe(400);
    });

    test('a group can hold 200 tasks; the 201st is refused', async () => {
        const { alice, group } = await setup();
        const due = new Date(DUE);
        await groupTaskModel.insertMany(Array.from({ length: 200 }, (_, i) => ({
            group: group._id, title: `Task ${i}`, dueDate: due, createdBy: alice.id,
        })));

        const res = await create(alice, group);
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('A group can have up to 200 tasks.');
    });

    test('a family-friendly group refuses a blocked word in a task', async () => {
        const { alice, group } = await setup();
        await alice.patch(`/api/groups/${group._id}`).send({ familyFriendly: true });

        const created = await create(alice, group, newTask({ title: 'this is bullshit' }));
        expect(created.status).toBe(400);
        expect(created.body.code).toBe('family_filter');

        const taskId = (await create(alice, group)).body.task._id;
        const edited = await edit(alice, group, taskId, { description: 'what the fuck' }, { description: '' });
        expect(edited.status).toBe(400);
        expect(edited.body.code).toBe('family_filter');
    });

    test('the 61st plan write in a minute is 429', async () => {
        const { alice, group } = await setup();
        for (let i = 0; i < 60; i += 1) {
            expect((await create(alice, group, newTask({ title: `Task ${i}` }))).status).toBe(201);
        }
        const res = await create(alice, group);
        expect(res.status).toBe(429);
        expect(res.body.message).toBe('Slow down a little.');
    });
});

describe('plan stamp and presence', () => {
    test('planAt changes after every create, edit and delete', async () => {
        const { alice, ann, group } = await setup();
        const start = await planAt(alice, group);
        expect(start).toBeNull();

        const taskId = (await create(ann, group)).body.task._id;
        const afterCreate = await planAt(alice, group);
        expect(afterCreate).not.toBe(start);

        await new Promise((resolve) => { setTimeout(resolve, 5); });
        await edit(ann, group, taskId, { hours: 3 }, { hours: 2 });
        const afterEdit = await planAt(alice, group);
        expect(afterEdit).not.toBe(afterCreate);

        await new Promise((resolve) => { setTimeout(resolve, 5); });
        await remove(ann, group, taskId);
        expect(await planAt(alice, group)).not.toBe(afterEdit);
    });

    test('a group task notifies the other members once', async () => {
        const { alice, ann, bob, group } = await setup();
        const taskId = (await create(alice, group)).body.task._id;
        await edit(ann, group, taskId, { hours: 3 }, { hours: 2 });

        const notes = await notificationModel.find({ type: 'group_task' });
        expect(notes.map((n) => String(n.recipient)).sort()).toEqual([ann.id, bob.id].sort());
        expect(notes[0].message).toBe('Alice added a group task: Lab report');
    });

    test('an admin editing a task shows in the owner\'s presence with that task', async () => {
        const { alice, ann, bob, group } = await setup();
        const taskId = (await create(alice, group)).body.task._id;

        await stamp(ann, group, taskId);
        await stamp(bob, group);
        const view = await stamp(alice, group);
        expect(view.body.presence).toEqual([
            { userId: ann.id, editing: taskId },
            { userId: bob.id, editing: null },
        ]);
    });

    test('a task id from another group is ignored as "editing"', async () => {
        const { alice, ann, group } = await setup();
        const { group: other } = (await alice.post('/api/groups').send({ name: 'Other' })).body;
        const foreignId = (await create(alice, other)).body.task._id;

        await stamp(ann, group, foreignId);
        expect((await stamp(alice, group)).body.presence).toEqual([{ userId: ann.id, editing: null }]);
    });

    test('someone removed from the group drops out of presence', async () => {
        const { alice, bob, group } = await setup();
        await stamp(bob, group);
        await alice.delete(`/api/groups/${group._id}/members/${bob.id}`);
        expect((await stamp(alice, group)).body.presence).toEqual([]);
    });

    test('presence older than 15 s is gone', () => {
        const start = 1_000_000;
        seen('g1', 'ann', 'task1', start);
        seen('g1', 'bob', null, start + 10_000);
        expect(present('g1', start + PRESENCE_FRESH_MS - 1)).toEqual([
            { userId: 'ann', editing: 'task1' },
            { userId: 'bob', editing: null },
        ]);
        expect(present('g1', start + PRESENCE_FRESH_MS)).toEqual([{ userId: 'bob', editing: null }]);
        expect(present('g1', start + 30_000)).toEqual([]);
    });

    test('presence keeps at most 50 people per group, dropping the longest unseen', () => {
        for (let i = 0; i < 60; i += 1) seen('g2', `user${i}`, null, 1000 + i);
        const people = present('g2', 1100);
        expect(people).toHaveLength(50);
        expect(people[0].userId).toBe('user10');
        expect(people[49].userId).toBe('user59');
    });
});

describe('deleting a group', () => {
    test('removes all its tasks', async () => {
        const { alice, ann, group } = await setup();
        await create(alice, group);
        await create(ann, group, newTask({ title: 'Quiz prep' }));
        expect(await groupTaskModel.countDocuments({ group: group._id })).toBe(2);

        await alice.delete(`/api/groups/${group._id}`);
        expect(await groupTaskModel.countDocuments({})).toBe(0);
    });
});
