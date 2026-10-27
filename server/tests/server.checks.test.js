import { describe, test, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import groupModel from '../models/groupMode.js';
import scheduleModel from '../models/scheduleModel.js';
import { fetchPublicHolidays, resetHolidayCache } from '../utils/holidays.js';
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
    return agent;
};

const pair = async () => ({
    alice: await signUp('alice@student.fatima.edu.ph', 'Alice'),
    bob: await signUp('bob@student.fatima.edu.ph', 'Bob'),
});

const BAD_ID = 'not-an-id';

describe('S3: a join code is required', () => {
    test('a removed member cannot get back in with the group id', async () => {
        const { alice, bob } = await pair();
        const group = (await alice.post('/api/groups').send({ name: 'Study Squad' })).body.group;
        await bob.post('/api/groups/join').send({ joinCode: group.joinCode });
        await alice.delete(`/api/groups/${group._id}/members/${bob.id}`);

        const res = await bob.post('/api/groups/join').send({ groupId: group._id });
        expect(res.body).toMatchObject({ success: false, message: 'Group not found' });
        const stored = await groupModel.findById(group._id);
        expect(stored.members.map(String)).not.toContain(bob.id);
    });

    test('the code still works', async () => {
        const { alice, bob } = await pair();
        const group = (await alice.post('/api/groups').send({ name: 'Study Squad' })).body.group;
        const res = await bob.post('/api/groups/join').send({ joinCode: group.joinCode.toLowerCase() });
        expect(res.body.success).toBe(true);
    });
});

describe('S7: task limits', () => {
    const task = (overrides = {}) => ({
        title: 'Report', course: 'CS 101', dueDate: '2026-11-01', hours: 2, ...overrides,
    });

    test('create rejects overlong text and non-string titles', async () => {
        const { alice } = await pair();
        expect((await alice.post('/api/tasks').send(task({ title: 'x'.repeat(121) }))).status).toBe(400);
        expect((await alice.post('/api/tasks').send(task({ course: 'x'.repeat(81) }))).status).toBe(400);
        expect((await alice.post('/api/tasks').send(task({ description: 'x'.repeat(1001) }))).status).toBe(400);
        expect((await alice.post('/api/tasks').send(task({ title: 42 }))).status).toBe(400);
        expect((await alice.post('/api/tasks').send(task({ title: 'x'.repeat(120) }))).status).toBe(200);
    });

    test('update runs the same checks on the fields that were sent', async () => {
        const { alice } = await pair();
        const created = (await alice.post('/api/tasks').send(task())).body.task;
        const put = (body) => alice.put(`/api/tasks/${created._id}`).send(body);

        expect((await put({ title: 42 })).status).toBe(400);
        expect((await put({ title: '   ' })).status).toBe(400);
        expect((await put({ title: 'x'.repeat(121) })).status).toBe(400);
        expect((await put({ hours: 0 })).status).toBe(400);
        expect((await put({ hours: 'lots' })).status).toBe(400);
        expect((await put({ difficulty: 6 })).status).toBe(400);
        expect((await put({ importance: 0 })).status).toBe(400);
        expect((await put({ dueDate: 'tomorrow-ish' })).status).toBe(400);

        const ok = await put({ isCompleted: true });
        expect(ok.status).toBe(200);
        expect(ok.body.task.isCompleted).toBe(true);
        const renamed = await put({ title: '  New title ', hours: 4 });
        expect(renamed.body.task).toMatchObject({ title: 'New title', hours: 4 });
    });
});

describe('FE-4: tasks without a course, and the checks quick add relies on', () => {
    test('create works without a course and stores an empty one', async () => {
        const { alice } = await pair();
        const res = await alice.post('/api/tasks').send({ title: 'Read chapter 3', dueDate: '2026-11-01', hours: 1 });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.task.course).toBe('');
        const blank = await alice.post('/api/tasks').send({ title: 'Quiz prep', course: '   ', dueDate: '2026-11-01' });
        expect(blank.body.task.course).toBe('');
        const list = (await alice.get('/api/tasks')).body.tasks;
        expect(list.map((t) => t.course)).toEqual(['', '']);
    });

    test('title and due date are still required', async () => {
        const { alice } = await pair();
        expect((await alice.post('/api/tasks').send({ course: 'CS 101', dueDate: '2026-11-01' })).status).toBe(400);
        expect((await alice.post('/api/tasks').send({ title: '   ', dueDate: '2026-11-01' })).status).toBe(400);
        expect((await alice.post('/api/tasks').send({ title: 'No date' })).status).toBe(400);
        expect((await alice.post('/api/tasks').send({ title: 'Bad date', dueDate: 'next-ish' })).status).toBe(400);
    });

    test('hours must be at least 0.5 and a number', async () => {
        const { alice } = await pair();
        const send = (hours) => alice.post('/api/tasks').send({ title: 'Lab', dueDate: '2026-11-01', hours });
        expect((await send(0)).status).toBe(400);
        expect((await send(0.4)).status).toBe(400);
        expect((await send('lots')).status).toBe(400);
        expect((await send(0.5)).status).toBe(200);
        expect((await send(4)).status).toBe(200);
    });

    test('a course can be cleared on edit, and a long one is still refused', async () => {
        const { alice } = await pair();
        const created = (await alice.post('/api/tasks').send({ title: 'Essay', course: 'ENG 2', dueDate: '2026-11-01' })).body.task;
        const cleared = await alice.put(`/api/tasks/${created._id}`).send({ course: '' });
        expect(cleared.status).toBe(200);
        expect(cleared.body.task.course).toBe('');
        expect((await alice.put(`/api/tasks/${created._id}`).send({ course: 'x'.repeat(81) })).status).toBe(400);
        const set = await alice.put(`/api/tasks/${created._id}`).send({ course: ' HIST 1 ' });
        expect(set.body.task.course).toBe('HIST 1');
    });

    test('a task without a course can be shared and imported', async () => {
        const { alice, bob } = await pair();
        const created = (await alice.post('/api/tasks').send({ title: 'Group notes', dueDate: '2026-11-01' })).body.task;
        const listed = (await alice.get('/api/tasks')).body.tasks[0];
        const imported = await bob.post('/api/tasks/import').send({ shareTag: listed.shareTag || created.shareTag });
        expect(imported.body.success).toBe(true);
        expect(imported.body.task.course).toBe('');
    });
});

describe('S7: profile limits', () => {
    test('rejects values the workload maths cannot use', async () => {
        const { alice } = await pair();
        const bad = [
            { studentName: 'x'.repeat(61) },
            { studentName: '   ' },
            { program: 'x'.repeat(81) },
            { studyHoursPerDay: 0 },
            { studyHoursPerDay: 13 },
            { studyHoursPerDay: -5 },
            { sleepHours: 3 },
            { sleepHours: 13 },
            { sleepHours: 'lots' },
            { travelMinutesPerDay: -1 },
            { travelMinutesPerDay: 241 },
        ];
        for (const body of bad) {
            const res = await alice.put('/api/user/profile').send(body);
            expect(res.body.success, JSON.stringify(body)).toBe(false);
        }
    });

    test('saves good values, trimmed', async () => {
        const { alice } = await pair();
        const res = await alice.put('/api/user/profile').send({
            studentName: '  Alice Cruz ', program: ' BSIT ', studyHoursPerDay: 5, sleepHours: 7.5, travelMinutesPerDay: 90,
        });
        expect(res.body.success).toBe(true);
        expect(res.body.userData).toMatchObject({
            name: 'Alice Cruz', program: 'BSIT', studyHoursPerDay: 5, sleepHours: 7.5, travelMinutesPerDay: 90,
        });
    });
});

describe('B14: bad ids and odd input', () => {
    test('bad ids answer 404 instead of a database error', async () => {
        const { alice } = await pair();
        expect((await alice.put(`/api/tasks/${BAD_ID}`).send({ title: 'x' })).status).toBe(404);
        expect((await alice.delete(`/api/tasks/${BAD_ID}`)).status).toBe(404);
        expect((await alice.delete(`/api/friends/${BAD_ID}`)).status).toBe(404);
        expect((await alice.put(`/api/friends/accept/${BAD_ID}`)).status).toBe(404);
        expect((await alice.post('/api/groups/leave').send({ groupId: BAD_ID })).body.message).toBe('Group not found');
        expect((await alice.delete(`/api/groups/${BAD_ID}`)).body.message).toBe('Group not found or unauthorized');
    });

    test('a schedule entry whose days is not a list is a plain 400', async () => {
        const { alice } = await pair();
        const schedule = (await alice.post('/api/schedules').send({ title: 'Fall' })).body.schedule;
        for (const days of ['monday', 5, { 0: 1 }]) {
            const res = await alice.post(`/api/schedules/${schedule._id}/entries`).send({
                title: 'Math', startTime: '09:00', endTime: '10:00', days,
            });
            expect(res.status, JSON.stringify(days)).toBe(400);
        }
    });
});

describe('B13: share notifications come after the save', () => {
    test('joining with a code saves first, so the owner is told about something real', async () => {
        const { alice, bob } = await pair();
        const schedule = (await alice.post('/api/schedules').send({ title: 'Fall' })).body.schedule;
        const code = (await alice.put(`/api/schedules/${schedule._id}/share-code`).send({ enabled: true, role: 'viewer' })).body;
        const shareCode = code.shareCode || code.schedule?.shareCode;
        expect(shareCode).toBeTruthy();

        const joined = await bob.post('/api/schedules/join').send({ shareCode });
        expect(joined.body.success).toBe(true);
        const stored = await scheduleModel.findById(schedule._id);
        expect(stored.collaborators.map((c) => String(c.user))).toContain(bob.id);

        const inbox = await alice.get('/api/notifications');
        expect(inbox.body.notifications.some((n) => n.type === 'schedule_change')).toBe(true);
    });
});

describe('B12: holiday service failures', () => {
    // The route tests mock utils/holidays.js, so these exercise the real module with a fake fetch.
    let realFetch;
    beforeEach(() => {
        realFetch = globalThis.fetch;
        resetHolidayCache();
    });
    afterEach(() => {
        globalThis.fetch = realFetch;
        resetHolidayCache();
    });

    test('a failure is remembered, so the next calls do not hit the service again', async () => {
        const spy = vi.fn().mockResolvedValue({ ok: false, status: 503 });
        globalThis.fetch = spy;

        await expect(fetchPublicHolidays(2026, 'PH')).rejects.toThrow('503');
        await expect(fetchPublicHolidays(2026, 'PH')).rejects.toThrow('503');
        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('the failure is forgotten after 10 minutes', async () => {
        vi.useFakeTimers();
        try {
            const spy = vi.fn().mockResolvedValue({ ok: false, status: 503 });
            globalThis.fetch = spy;
            await expect(fetchPublicHolidays(2026, 'PH')).rejects.toThrow();
            vi.advanceTimersByTime(10 * 60 * 1000 + 1);
            await expect(fetchPublicHolidays(2026, 'PH')).rejects.toThrow();
            expect(spy).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    test('parallel calls for one year share one request, and success is cached', async () => {
        const spy = vi.fn().mockResolvedValue({
            ok: true, status: 200, json: async () => [{ date: '2026-12-25', localName: 'Pasko', name: 'Christmas Day' }],
        });
        globalThis.fetch = spy;

        const [a, b, c] = await Promise.all([
            fetchPublicHolidays(2026, 'PH'), fetchPublicHolidays(2026, 'PH'), fetchPublicHolidays(2026, 'PH'),
        ]);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(a).toEqual(b);
        expect(c[0]).toMatchObject({ date: '2026-12-25', name: 'Pasko', englishName: 'Christmas Day' });

        await fetchPublicHolidays(2026, 'PH');
        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('a different year is a separate request', async () => {
        const spy = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
        globalThis.fetch = spy;
        await fetchPublicHolidays(2026, 'PH');
        await fetchPublicHolidays(2027, 'PH');
        expect(spy).toHaveBeenCalledTimes(2);
    });
});
