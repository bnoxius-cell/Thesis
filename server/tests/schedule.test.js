import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import userModel from '../models/userModel.js';
import Friend from '../models/Friend.js';
import scheduleModel from '../models/scheduleModel.js';
import notificationModel from '../models/notificationModel.js';
import { fetchPublicHolidays } from '../utils/holidays.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';

vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
}));

// Never hit the real holiday API from tests.
vi.mock('../utils/holidays.js', () => ({ fetchPublicHolidays: vi.fn() }));

beforeAll(connectTestDB);
beforeEach(async () => {
    await clearTestDB();
    fetchPublicHolidays.mockReset();
});
afterAll(closeTestDB);

const signUp = async (email, name) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email, name }));
    return agent;
};

const idOf = async (email) => (await userModel.findOne({ email }))._id.toString();

const entryPayload = (overrides = {}) => ({
    title: 'Data Structures',
    kind: 'class',
    days: [1, 3],
    startTime: '09:00',
    endTime: '10:30',
    location: 'Room 204',
    ...overrides,
});

// alice owns a schedule, bob is her friend, carol is a stranger.
const setup = async () => {
    const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
    const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
    const carol = await signUp('carol@student.fatima.edu.ph', 'Carol');
    const aliceId = await idOf('alice@student.fatima.edu.ph');
    const bobId = await idOf('bob@student.fatima.edu.ph');
    await Friend.create({ user: aliceId, friend: bobId, status: 'accepted' });

    const created = await alice.post('/api/schedules').send({ title: 'Fall term' });
    return { alice, bob, carol, aliceId, bobId, schedule: created.body.schedule };
};

describe('creating and listing schedules', () => {
    test('creates a schedule with defaults', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const res = await alice.post('/api/schedules').send({ title: '  Fall term ' });

        expect(res.status).toBe(201);
        expect(res.body.schedule).toMatchObject({ title: 'Fall term', theme: 'classic', country: 'PH', role: 'owner' });
    });

    test('needs a name and a known theme', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');

        expect((await alice.post('/api/schedules').send({ title: '   ' })).status).toBe(400);
        expect((await alice.post('/api/schedules').send({ title: 'x', theme: 'neon' })).status).toBe(400);
    });

    test('requires login', async () => {
        const res = await request(app).get('/api/schedules');
        expect(res.body.success).toBe(false);
    });

    test('lists owned and shared schedules with the right role', async () => {
        const { alice, bob, bobId, schedule } = await setup();
        await alice.post(`/api/schedules/${schedule._id}/share`).send({ userId: bobId });

        const aliceList = await alice.get('/api/schedules');
        const bobList = await bob.get('/api/schedules');

        expect(aliceList.body.schedules).toHaveLength(1);
        expect(aliceList.body.schedules[0].role).toBe('owner');
        expect(bobList.body.schedules).toHaveLength(1);
        expect(bobList.body.schedules[0].role).toBe('viewer');
        expect(bobList.body.schedules[0].entries).toBeUndefined();
    });
});

describe('entries', () => {
    test('adds, edits and deletes a recurring class', async () => {
        const { alice, schedule } = await setup();
        const base = `/api/schedules/${schedule._id}/entries`;

        const added = await alice.post(base).send(entryPayload());
        expect(added.status).toBe(201);
        const entry = added.body.schedule.entries[0];
        expect(entry).toMatchObject({ title: 'Data Structures', days: [1, 3], skipOnHoliday: true });

        const edited = await alice.put(`${base}/${entry._id}`).send(entryPayload({ title: 'Algorithms', days: [2] }));
        expect(edited.body.schedule.entries[0]).toMatchObject({ title: 'Algorithms', days: [2] });

        const removed = await alice.delete(`${base}/${entry._id}`);
        expect(removed.body.schedule.entries).toHaveLength(0);
    });

    test('activities do not skip holidays by default', async () => {
        const { alice, schedule } = await setup();
        const res = await alice
            .post(`/api/schedules/${schedule._id}/entries`)
            .send(entryPayload({ kind: 'activity', title: 'Gym' }));

        expect(res.body.schedule.entries[0].skipOnHoliday).toBe(false);
    });

    test.each([
        ['a missing title', { title: ' ' }],
        ['an end time before the start', { startTime: '11:00', endTime: '10:00' }],
        ['a malformed time', { startTime: '9am' }],
        ['no days and no date', { days: [] }],
        ['a day out of range', { days: [7] }],
        ['an impossible date', { days: [], date: '2026-02-31' }],
        ['a bad color', { color: 'red' }],
        ['a non-image picture', { image: 'data:text/html;base64,PGgxPg==' }],
    ])('rejects %s', async (_label, overrides) => {
        const { alice, schedule } = await setup();
        const res = await alice.post(`/api/schedules/${schedule._id}/entries`).send(entryPayload(overrides));

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    test('accepts a small picture and rejects an oversized one', async () => {
        const { alice, schedule } = await setup();
        const base = `/api/schedules/${schedule._id}/entries`;
        const small = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
        const huge = `data:image/jpeg;base64,${'A'.repeat(101 * 1024)}`;

        const ok = await alice.post(base).send(entryPayload({ image: small }));
        expect(ok.body.schedule.entries[0].image).toBe(small);
        expect((await alice.post(base).send(entryPayload({ image: huge }))).status).toBe(400);
    });

    test('supports one-off entries on a specific date', async () => {
        const { alice, schedule } = await setup();
        const res = await alice
            .post(`/api/schedules/${schedule._id}/entries`)
            .send(entryPayload({ kind: 'activity', days: [], date: '2026-10-15' }));

        expect(res.body.schedule.entries[0]).toMatchObject({ date: '2026-10-15', days: [] });
    });
});

describe('holidays', () => {
    test('returns the public holiday list for a year and country', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        fetchPublicHolidays.mockResolvedValue([{ date: '2026-12-25', name: 'Christmas Day', englishName: 'Christmas Day' }]);

        const res = await alice.get('/api/schedules/holidays?year=2026&country=ph');

        expect(res.body.holidays).toHaveLength(1);
        expect(fetchPublicHolidays).toHaveBeenCalledWith(2026, 'PH');
    });

    test('reports a soft failure when the holiday service is down', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        fetchPublicHolidays.mockRejectedValue(new Error('network'));

        const res = await alice.get('/api/schedules/holidays?year=2026&country=PH');

        expect(res.status).toBe(502);
        expect(res.body.success).toBe(false);
    });

    test('validates year and country', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');

        expect((await alice.get('/api/schedules/holidays?year=abc&country=PH')).status).toBe(400);
        expect((await alice.get('/api/schedules/holidays?year=2026&country=PHL')).status).toBe(400);
    });

    test('marks, renames, un-marks and resets a day', async () => {
        const { alice, schedule } = await setup();
        const url = `/api/schedules/${schedule._id}/holidays`;

        const marked = await alice.put(url).send({ date: '2026-11-02', state: 'holiday', name: 'Founders Day' });
        expect(marked.body.schedule.holidayOverrides).toEqual([{ date: '2026-11-02', state: 'holiday', name: 'Founders Day' }]);

        const renamed = await alice.put(url).send({ date: '2026-11-02', state: 'holiday', name: 'School Day Off' });
        expect(renamed.body.schedule.holidayOverrides).toHaveLength(1);
        expect(renamed.body.schedule.holidayOverrides[0].name).toBe('School Day Off');

        const unmarked = await alice.put(url).send({ date: '2026-12-25', state: 'workday' });
        expect(unmarked.body.schedule.holidayOverrides).toHaveLength(2);

        const reset = await alice.put(url).send({ date: '2026-11-02', state: null });
        expect(reset.body.schedule.holidayOverrides).toEqual([{ date: '2026-12-25', state: 'workday', name: '' }]);
    });

    test('rejects an invalid date or state', async () => {
        const { alice, schedule } = await setup();
        const url = `/api/schedules/${schedule._id}/holidays`;

        expect((await alice.put(url).send({ date: 'soon', state: 'holiday' })).status).toBe(400);
        expect((await alice.put(url).send({ date: '2026-11-02', state: 'party' })).status).toBe(400);
    });
});

describe('sharing and permissions', () => {
    test('strangers cannot open or edit a schedule', async () => {
        const { carol, schedule } = await setup();

        expect((await carol.get(`/api/schedules/${schedule._id}`)).status).toBe(403);
        expect((await carol.post(`/api/schedules/${schedule._id}/entries`).send(entryPayload())).status).toBe(403);
    });

    test('a viewer can read but not edit, and cannot manage sharing', async () => {
        const { alice, bob, bobId, schedule } = await setup();
        await alice.post(`/api/schedules/${schedule._id}/share`).send({ userId: bobId });

        const read = await bob.get(`/api/schedules/${schedule._id}`);
        expect(read.body.schedule.role).toBe('viewer');
        expect(read.body.schedule.collaborators).toEqual([]);
        expect(read.body.schedule.shareCode).toBeUndefined();

        expect((await bob.post(`/api/schedules/${schedule._id}/entries`).send(entryPayload())).status).toBe(403);
        expect((await bob.put(`/api/schedules/${schedule._id}`).send({ theme: 'cute' })).status).toBe(403);
        expect((await bob.put(`/api/schedules/${schedule._id}/holidays`).send({ date: '2026-11-02', state: 'holiday' })).status).toBe(403);
        expect((await bob.put(`/api/schedules/${schedule._id}/share-code`).send({ enabled: true })).status).toBe(403);
        expect((await bob.delete(`/api/schedules/${schedule._id}`)).status).toBe(403);
    });

    test('sharing is view-only even if an editor role is asked for', async () => {
        const { alice, bob, bobId, schedule } = await setup();
        const shared = await alice.post(`/api/schedules/${schedule._id}/share`).send({ userId: bobId, role: 'editor' });
        expect(shared.body.schedule.collaborators[0].role).toBe('viewer');

        expect((await bob.post(`/api/schedules/${schedule._id}/entries`).send(entryPayload())).status).toBe(403);
        expect((await bob.put(`/api/schedules/${schedule._id}`).send({ theme: 'cute' })).status).toBe(403);
    });

    test('an older editor share is treated as view-only', async () => {
        const { bob, bobId, schedule } = await setup();
        await scheduleModel.updateOne({ _id: schedule._id }, { $push: { collaborators: { user: bobId, role: 'editor' } } });

        const read = await bob.get(`/api/schedules/${schedule._id}`);
        expect(read.body.schedule.role).toBe('viewer');
        expect((await bob.post(`/api/schedules/${schedule._id}/entries`).send(entryPayload())).status).toBe(403);
    });

    test('sharing only works with friends and notifies them', async () => {
        const { alice, aliceId, bobId, schedule } = await setup();
        const carolId = await idOf('carol@student.fatima.edu.ph');

        const stranger = await alice.post(`/api/schedules/${schedule._id}/share`).send({ userId: carolId });
        expect(stranger.status).toBe(403);

        const shared = await alice.post(`/api/schedules/${schedule._id}/share`).send({ userId: bobId });
        expect(shared.body.schedule.collaborators).toHaveLength(1);

        const note = await notificationModel.findOne({ recipient: bobId });
        expect(note.type).toBe('schedule_share');
        expect(note.sender.toString()).toBe(aliceId);
    });

    test('re-sharing does not duplicate the person or notify twice', async () => {
        const { alice, bobId, schedule } = await setup();
        const url = `/api/schedules/${schedule._id}/share`;
        await alice.post(url).send({ userId: bobId });
        const res = await alice.post(url).send({ userId: bobId });

        expect(res.body.schedule.collaborators).toHaveLength(1);
        expect(await notificationModel.countDocuments({ recipient: bobId })).toBe(1);
    });

    test('the owner can remove someone, and a collaborator can leave', async () => {
        const { alice, bob, bobId, schedule } = await setup();
        const share = `/api/schedules/${schedule._id}/share`;

        await alice.post(share).send({ userId: bobId });
        const removed = await alice.delete(`${share}/${bobId}`);
        expect(removed.body.schedule.collaborators).toHaveLength(0);
        expect((await bob.get(`/api/schedules/${schedule._id}`)).status).toBe(403);

        await alice.post(share).send({ userId: bobId });
        expect((await bob.delete(`${share}/${bobId}`)).body.success).toBe(true);
        expect((await bob.get(`/api/schedules/${schedule._id}`)).status).toBe(403);
    });

    test('a collaborator cannot remove somebody else', async () => {
        const { alice, bob, bobId, aliceId, schedule } = await setup();
        await alice.post(`/api/schedules/${schedule._id}/share`).send({ userId: bobId });

        const res = await bob.delete(`/api/schedules/${schedule._id}/share/${aliceId}`);
        expect(res.status).toBe(403);
    });
});

describe('share codes', () => {
    test('a code lets anyone join as a viewer, and can be turned off', async () => {
        const { alice, carol, schedule } = await setup();
        const url = `/api/schedules/${schedule._id}/share-code`;

        const on = await alice.put(url).send({ enabled: true, role: 'editor' });
        const code = on.body.schedule.shareCode;
        expect(code).toMatch(/^[A-Z2-9]{6}$/);

        const joined = await carol.post('/api/schedules/join').send({ shareCode: code.toLowerCase() });
        expect(joined.body.schedule.role).toBe('viewer');
        expect((await carol.post(`/api/schedules/${schedule._id}/entries`).send(entryPayload())).status).toBe(403);

        await alice.put(url).send({ enabled: false });
        const after = await carol.post('/api/schedules/join').send({ shareCode: code });
        expect(after.status).toBe(404);
    });

    test('regenerating invalidates the old code', async () => {
        const { alice, carol, schedule } = await setup();
        const url = `/api/schedules/${schedule._id}/share-code`;
        const first = (await alice.put(url).send({ enabled: true })).body.schedule.shareCode;
        const second = (await alice.put(url).send({ regenerate: true })).body.schedule.shareCode;

        expect(second).not.toBe(first);
        expect((await carol.post('/api/schedules/join').send({ shareCode: first })).status).toBe(404);
    });

    test('joining as the owner does not downgrade or duplicate access', async () => {
        const { alice, schedule } = await setup();
        const code = (await alice.put(`/api/schedules/${schedule._id}/share-code`).send({ enabled: true })).body.schedule.shareCode;

        const res = await alice.post('/api/schedules/join').send({ shareCode: code });
        expect(res.body.schedule.role).toBe('owner');
        expect(res.body.schedule.collaborators).toHaveLength(0);
    });
});

describe('duplicating and deleting', () => {
    test('a viewer can copy a schedule into their own editable one', async () => {
        const { alice, bob, bobId, schedule } = await setup();
        await alice.post(`/api/schedules/${schedule._id}/entries`).send(entryPayload());
        await alice.put(`/api/schedules/${schedule._id}/holidays`).send({ date: '2026-11-02', state: 'holiday', name: 'Day off' });
        await alice.post(`/api/schedules/${schedule._id}/share`).send({ userId: bobId });

        const copy = await bob.post(`/api/schedules/${schedule._id}/duplicate`);

        expect(copy.status).toBe(201);
        expect(copy.body.schedule).toMatchObject({ title: 'Fall term (copy)', role: 'owner' });
        expect(copy.body.schedule.entries).toHaveLength(1);
        expect(copy.body.schedule.holidayOverrides).toHaveLength(1);
        expect(copy.body.schedule.collaborators).toHaveLength(0);

        // Editing the copy leaves the original alone.
        await bob.post(`/api/schedules/${copy.body.schedule._id}/entries`).send(entryPayload({ title: 'Extra' }));
        expect((await alice.get(`/api/schedules/${schedule._id}`)).body.schedule.entries).toHaveLength(1);
    });

    test('a stranger cannot copy a schedule', async () => {
        const { carol, schedule } = await setup();
        expect((await carol.post(`/api/schedules/${schedule._id}/duplicate`)).status).toBe(403);
    });

    test('the owner can delete it', async () => {
        const { alice, schedule } = await setup();
        expect((await alice.delete(`/api/schedules/${schedule._id}`)).body.success).toBe(true);
        expect((await alice.get(`/api/schedules/${schedule._id}`)).status).toBe(404);
    });

    test('an unknown id is a 404, not a crash', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        expect((await alice.get('/api/schedules/not-an-id')).status).toBe(404);
    });
});

describe('week overview for the dashboard', () => {
    const week = (agent, start = '2026-11-02') => agent.get(`/api/schedules/week?start=${start}`);

    test('needs a valid start date', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        expect((await week(alice, 'nope')).status).toBe(400);
    });

    test('is empty for someone with no schedules', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const res = await week(alice);
        expect(res.body.scheduleCount).toBe(0);
        expect(res.body.days).toHaveLength(7);
        expect(res.body.days.every((d) => d.busyHours === 0)).toBe(true);
    });

    test('adds up class and activity hours per day, counting overlaps once', async () => {
        fetchPublicHolidays.mockResolvedValue([]);
        const { alice, schedule } = await setup();
        const post = (body) => alice.post(`/api/schedules/${schedule._id}/entries`).send(body);
        await post(entryPayload({ days: [1], startTime: '09:00', endTime: '11:00' }));
        await post(entryPayload({ title: 'Overlap', days: [1], startTime: '10:00', endTime: '12:00' }));
        await post(entryPayload({ title: 'Gym', kind: 'activity', days: [1], startTime: '17:00', endTime: '18:30' }));

        // 2026-11-02 is a Monday.
        const res = await week(alice);
        const monday = res.body.days[0];
        expect(monday.classHours).toBe(3);
        expect(monday.activityHours).toBe(1.5);
        expect(monday.busyHours).toBe(4.5);
        expect(monday.entries.map((e) => e.title)).toEqual(['Data Structures', 'Overlap', 'Gym']);
        expect(res.body.days[1].busyHours).toBe(0);
    });

    test('a holiday skips classes marked to skip but keeps other entries', async () => {
        fetchPublicHolidays.mockResolvedValue([{ date: '2026-11-02', name: 'Break Day' }]);
        const { alice, schedule } = await setup();
        const post = (body) => alice.post(`/api/schedules/${schedule._id}/entries`).send(body);
        await post(entryPayload({ days: [1], startTime: '09:00', endTime: '11:00' }));
        await post(entryPayload({ title: 'Choir', kind: 'activity', days: [1], startTime: '15:00', endTime: '16:00', skipOnHoliday: false }));

        const monday = (await week(alice)).body.days[0];
        expect(monday.holiday).toBe('Break Day');
        expect(monday.classHours).toBe(0);
        expect(monday.activityHours).toBe(1);

        // Marking it as a normal workday brings the class back.
        await alice.put(`/api/schedules/${schedule._id}/holidays`).send({ date: '2026-11-02', state: 'workday' });
        const again = (await week(alice)).body.days[0];
        expect(again.holiday).toBeNull();
        expect(again.classHours).toBe(2);
    });

    test('still works when the holiday service is down', async () => {
        fetchPublicHolidays.mockRejectedValue(new Error('down'));
        const { alice, schedule } = await setup();
        await alice.post(`/api/schedules/${schedule._id}/entries`).send(entryPayload({ days: [1] }));
        const res = await week(alice);
        expect(res.status).toBe(200);
        expect(res.body.days[0].classHours).toBe(1.5);
    });

    test('ignores schedules that are switched off and schedules owned by others', async () => {
        fetchPublicHolidays.mockResolvedValue([]);
        const { alice, bob, bobId, schedule } = await setup();
        await alice.post(`/api/schedules/${schedule._id}/entries`).send(entryPayload({ days: [1] }));
        await alice.post(`/api/schedules/${schedule._id}/share`).send({ userId: bobId });

        // Bob only views it, so it is not his week.
        expect((await week(bob)).body.scheduleCount).toBe(0);

        // The main schedule cannot be switched off. An extra can.
        await alice.put(`/api/schedules/${schedule._id}`).send({ countInWorkload: false });
        expect((await week(alice)).body.scheduleCount).toBe(1);

        const extra = (await alice.post('/api/schedules').send({ title: 'Gym' })).body.schedule;
        await alice.post(`/api/schedules/${extra._id}/entries`).send(entryPayload({ days: [2] }));
        expect((await week(alice)).body.scheduleCount).toBe(2);
        await alice.put(`/api/schedules/${extra._id}`).send({ countInWorkload: false });
        expect((await week(alice)).body.scheduleCount).toBe(1);
    });

    test('the same class in two of the owner schedules is counted once', async () => {
        fetchPublicHolidays.mockResolvedValue([]);
        const { alice, schedule } = await setup();
        await alice.post(`/api/schedules/${schedule._id}/entries`).send(entryPayload({ days: [1] }));
        await alice.post(`/api/schedules/${schedule._id}/duplicate`);

        const res = await week(alice);
        expect(res.body.scheduleCount).toBe(2);
        expect(res.body.days[0].classHours).toBe(1.5);
        expect(res.body.days[0].entries).toHaveLength(1);
    });
});
