import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';
import { entriesOverlap, isSameEntry, analyzeEntry, overlapsOnDay } from '../../client/src/utils/scheduleConflicts.js';

vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../utils/holidays.js', () => ({ fetchPublicHolidays: vi.fn().mockResolvedValue([]) }));

beforeAll(connectTestDB);
beforeEach(clearTestDB);
afterAll(closeTestDB);

const signUp = async (email, name) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email, name }));
    return agent;
};

const cls = (overrides = {}) => ({
    title: 'Data Structures', kind: 'class', days: [1, 3], startTime: '09:00', endTime: '10:30', ...overrides,
});

// alice owns a schedule with two classes and shares it in a group with bob. carol is outside.
const setup = async () => {
    const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
    const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
    const carol = await signUp('carol@student.fatima.edu.ph', 'Carol');
    const made = await alice.post('/api/schedules').send({ title: 'Fall term', theme: 'ocean' });
    const schedule = made.body.schedule;
    await alice.post(`/api/schedules/${schedule._id}/entries`).send(cls());
    await alice.post(`/api/schedules/${schedule._id}/entries`).send(cls({ title: 'Calculus', days: [2, 4], startTime: '13:00', endTime: '14:30' }));

    const group = (await alice.post('/api/groups').send({ name: 'Study Squad' })).body.group;
    await bob.post('/api/groups/join').send({ joinCode: group.joinCode });
    return { alice, bob, carol, schedule, group };
};

const postSchedule = (agent, group, scheduleId) => agent.post(`/api/groups/${group._id}/messages`).send({ scheduleId });

describe('conflict detection', () => {
    const weekly = (o) => ({ title: 'X', days: [1], startTime: '09:00', endTime: '10:00', ...o });

    test('overlapping weekly entries on a shared day clash, touching ones do not', () => {
        expect(entriesOverlap(weekly({}), weekly({ startTime: '09:30', endTime: '11:00' }))).toBe(true);
        expect(entriesOverlap(weekly({}), weekly({ startTime: '10:00', endTime: '11:00' }))).toBe(false);
        expect(entriesOverlap(weekly({}), weekly({ days: [2] }))).toBe(false);
    });

    test('date ranges matter for weekly entries', () => {
        const a = weekly({ startDate: '2026-08-01', endDate: '2026-10-31' });
        expect(entriesOverlap(a, weekly({ startDate: '2026-11-01' }))).toBe(false);
        expect(entriesOverlap(a, weekly({ startDate: '2026-10-15' }))).toBe(true);
    });

    test('one-off entries clash with weekly ones on the matching weekday only', () => {
        // 2026-11-02 is a Monday.
        expect(entriesOverlap(weekly({}), { title: 'Y', date: '2026-11-02', startTime: '09:15', endTime: '09:45' })).toBe(true);
        expect(entriesOverlap(weekly({}), { title: 'Y', date: '2026-11-03', startTime: '09:15', endTime: '09:45' })).toBe(false);
    });

    test('the same class entered twice is a duplicate, not a clash', () => {
        const mine = [{ scheduleTitle: 'Mine', entry: weekly({ title: 'Calculus' }) }];
        expect(isSameEntry(weekly({ title: ' calculus ' }), mine[0].entry)).toBe(true);
        const result = analyzeEntry(weekly({ title: 'Calculus' }), mine);
        expect(result.duplicate).toBeTruthy();
        expect(result.conflicts).toEqual([]);
        expect(analyzeEntry(weekly({ title: 'Physics' }), mine).conflicts).toHaveLength(1);
    });

    test('flags overlaps inside one day of a schedule', () => {
        const map = overlapsOnDay([
            { _id: 'a', title: 'A', startTime: '09:00', endTime: '10:00' },
            { _id: 'b', title: 'B', startTime: '09:30', endTime: '10:30' },
            { _id: 'c', title: 'C', startTime: '12:00', endTime: '13:00' },
        ]);
        expect(map.get('a')).toEqual(['B']);
        expect(map.get('b')).toEqual(['A']);
        expect(map.has('c')).toBe(false);
    });
});

describe('sharing a schedule in a group chat', () => {
    test('the owner can post it, and it shows up as a schedule message', async () => {
        const { alice, bob, schedule, group } = await setup();
        const res = await postSchedule(alice, group, schedule._id);

        expect(res.body.success).toBe(true);
        expect(res.body.message.type).toBe('schedule');
        expect(res.body.message.schedule).toMatchObject({ title: 'Fall term', ownerName: 'Alice' });
        expect(res.body.message.schedule.entries).toHaveLength(2);

        const seen = await bob.get(`/api/groups/${group._id}/messages`);
        expect(seen.body.messages[0].addedByMe).toBe(false);
    });

    test('only the owner can post a schedule, and it must have entries', async () => {
        const { alice, bob, schedule, group } = await setup();
        expect((await postSchedule(bob, group, schedule._id)).status).toBe(404);

        const empty = (await alice.post('/api/schedules').send({ title: 'Empty' })).body.schedule;
        expect((await postSchedule(alice, group, empty._id)).status).toBe(400);
    });
});

describe('previewing and copying a schedule', () => {
    const chatSource = async (alice, group, scheduleId) => {
        const message = (await postSchedule(alice, group, scheduleId)).body.message;
        return { groupId: group._id, messageId: message._id, entries: message.schedule.entries };
    };

    test('a group member sees the entries, and none of the caller schedules yet', async () => {
        const { alice, bob, schedule, group } = await setup();
        const source = await chatSource(alice, group, schedule._id);

        const res = await bob.post('/api/schedules/preview').send({ groupId: source.groupId, messageId: source.messageId });
        expect(res.body.success).toBe(true);
        expect(res.body.source).toMatchObject({ title: 'Fall term', ownerName: 'Alice', alreadyAdded: false });
        expect(res.body.entries).toHaveLength(2);
        expect(res.body.existing).toEqual([]);
    });

    test('people outside the group cannot preview or copy it', async () => {
        const { alice, carol, schedule, group } = await setup();
        const source = await chatSource(alice, group, schedule._id);
        const body = { groupId: source.groupId, messageId: source.messageId };

        expect((await carol.post('/api/schedules/preview').send(body)).status).toBe(403);
        expect((await carol.post('/api/schedules/import').send({ ...body, selections: [{ id: source.entries[0]._id }] })).status).toBe(403);
    });

    test('copies everything into a new schedule, then the chat shows it as added', async () => {
        const { alice, bob, schedule, group } = await setup();
        const source = await chatSource(alice, group, schedule._id);
        const body = { groupId: source.groupId, messageId: source.messageId };

        const res = await bob.post('/api/schedules/import').send({ ...body, selections: source.entries.map((e) => ({ id: e._id })) });
        expect(res.status).toBe(201);
        expect(res.body.added).toBe(2);
        expect(res.body.schedule).toMatchObject({ title: 'Fall term', theme: 'ocean', role: 'owner' });
        expect(res.body.schedule.entries.map((e) => e.title).sort()).toEqual(['Calculus', 'Data Structures']);

        const chat = await bob.get(`/api/groups/${group._id}/messages`);
        expect(chat.body.messages[0].addedByMe).toBe(true);
        // The original is untouched and still Alice's alone.
        expect((await alice.get(`/api/schedules/${schedule._id}`)).body.schedule.collaborators).toHaveLength(0);
    });

    test('lets the person skip entries and change a time before adding', async () => {
        const { alice, bob, schedule, group } = await setup();
        const source = await chatSource(alice, group, schedule._id);
        const ds = source.entries.find((e) => e.title === 'Data Structures');

        const res = await bob.post('/api/schedules/import').send({
            groupId: source.groupId,
            messageId: source.messageId,
            title: 'My term',
            selections: [{ id: ds._id, edits: { startTime: '11:00', endTime: '12:30' } }],
        });
        expect(res.body.schedule.title).toBe('My term');
        expect(res.body.schedule.entries).toHaveLength(1);
        expect(res.body.schedule.entries[0]).toMatchObject({ title: 'Data Structures', startTime: '11:00', endTime: '12:30' });
    });

    test('rejects an edit that makes an entry invalid, and an empty selection', async () => {
        const { alice, bob, schedule, group } = await setup();
        const source = await chatSource(alice, group, schedule._id);
        const body = { groupId: source.groupId, messageId: source.messageId };

        const bad = await bob.post('/api/schedules/import').send({ ...body, selections: [{ id: source.entries[0]._id, edits: { startTime: '12:00', endTime: '11:00' } }] });
        expect(bad.status).toBe(400);
        expect((await bob.post('/api/schedules/import').send({ ...body, selections: [] })).status).toBe(400);
        expect((await bob.post('/api/schedules/import').send({ ...body, selections: [{ id: 'nope' }] })).status).toBe(400);
    });

    test('can add into a schedule the person already has, and the preview lists clashes to check', async () => {
        const { alice, bob, schedule, group } = await setup();
        const mine = (await bob.post('/api/schedules').send({ title: 'Bob term' })).body.schedule;
        await bob.post(`/api/schedules/${mine._id}/entries`).send(cls({ title: 'Physics', startTime: '09:30', endTime: '11:00' }));
        const source = await chatSource(alice, group, schedule._id);
        const body = { groupId: source.groupId, messageId: source.messageId };

        const preview = await bob.post('/api/schedules/preview').send(body);
        expect(preview.body.existing).toHaveLength(1);
        expect(preview.body.existing[0]).toMatchObject({ scheduleTitle: 'Bob term' });
        expect(preview.body.schedules.map((s) => s.title)).toEqual(['Bob term']);

        const res = await bob.post('/api/schedules/import').send({ ...body, targetScheduleId: mine._id, selections: source.entries.map((e) => ({ id: e._id })) });
        expect(res.body.schedule._id).toBe(mine._id);
        expect(res.body.schedule.entries).toHaveLength(3);
    });

    test("cannot add into someone else's schedule", async () => {
        const { alice, bob, schedule, group } = await setup();
        const source = await chatSource(alice, group, schedule._id);
        const res = await bob.post('/api/schedules/import').send({
            groupId: source.groupId, messageId: source.messageId, targetScheduleId: schedule._id, selections: [{ id: source.entries[0]._id }],
        });
        expect(res.status).toBe(404);
    });

    test('works from a share code too, with pictures kept, and refuses your own code', async () => {
        const { alice, bob, schedule } = await setup();
        const code = (await alice.put(`/api/schedules/${schedule._id}/share-code`).send({ enabled: true })).body.schedule.shareCode;

        const preview = await bob.post('/api/schedules/preview').send({ shareCode: code.toLowerCase() });
        expect(preview.body.entries).toHaveLength(2);

        const res = await bob.post('/api/schedules/import').send({ shareCode: code, selections: preview.body.entries.map((e) => ({ id: e._id })) });
        expect(res.body.added).toBe(2);
        expect((await bob.post('/api/schedules/preview').send({ shareCode: code })).body.source.alreadyAdded).toBe(true);

        expect((await alice.post('/api/schedules/preview').send({ shareCode: code })).status).toBe(400);
        expect((await bob.post('/api/schedules/preview').send({ shareCode: 'NOPE22' })).status).toBe(404);
    });
});

describe('sharing a task: preview and duplicates', () => {
    const task = (o = {}) => ({ title: 'Lab report', course: 'PHYS 101', dueDate: '2030-01-15', hours: 2, difficulty: 3, importance: 3, ...o });

    test('preview says whether you already have it and what else is due around then', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
        const created = await alice.post('/api/tasks').send(task());
        const group = (await alice.post('/api/groups').send({ name: 'G' })).body.group;
        await bob.post('/api/groups/join').send({ joinCode: group.joinCode });
        const tag = (await alice.post(`/api/groups/${group._id}/messages`).send({ taskId: created.body.task._id })).body.message.task.shareTag;

        await bob.post('/api/tasks').send(task({ title: 'Essay', dueDate: '2030-01-16', hours: 4 }));
        await bob.post('/api/tasks').send(task({ title: 'Far away', dueDate: '2030-03-01' }));

        const preview = await bob.get(`/api/tasks/share/${tag}`);
        expect(preview.body.alreadyAdded).toBe(false);
        expect(preview.body.nearby.map((t) => t.title)).toEqual(['Essay']);

        expect((await bob.post('/api/tasks/import').send({ shareTag: tag })).body.success).toBe(true);
        expect((await bob.get(`/api/tasks/share/${tag}`)).body.alreadyAdded).toBe(true);
    });

    test('adding the same shared task twice is refused', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
        const created = await alice.post('/api/tasks').send(task());
        const group = (await alice.post('/api/groups').send({ name: 'G' })).body.group;
        await bob.post('/api/groups/join').send({ joinCode: group.joinCode });
        const tag = (await alice.post(`/api/groups/${group._id}/messages`).send({ taskId: created.body.task._id })).body.message.task.shareTag;

        await bob.post('/api/tasks/import').send({ shareTag: tag });
        const again = await bob.post('/api/tasks/import').send({ shareTag: tag });
        expect(again.status).toBe(409);
        expect(again.body.message).toMatch(/already have/i);
        expect((await bob.get('/api/tasks')).body.tasks).toHaveLength(1);
    });
});
