import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import userModel from '../models/userModel.js';
import Friend from '../models/Friend.js';
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
vi.mock('../utils/holidays.js', () => ({ fetchPublicHolidays: vi.fn().mockResolvedValue([]) }));

beforeAll(connectTestDB);
beforeEach(async () => {
    await clearTestDB();
    fetchPublicHolidays.mockClear();
});
afterAll(closeTestDB);

const signUp = async (email, name) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email, name }));
    return agent;
};
const idOf = async (email) => (await userModel.findOne({ email }))._id.toString();

const entry = (overrides = {}) => ({
    title: 'Data Structures', kind: 'class', days: [1, 3], startTime: '09:00', endTime: '10:30', ...overrides,
});

// Alice owns "BSCS 2A", Bob and Dan are her friends, Carol is a stranger.
const setup = async () => {
    const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
    const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
    const carol = await signUp('carol@student.fatima.edu.ph', 'Carol');
    const dan = await signUp('dan@student.fatima.edu.ph', 'Dan');
    const aliceId = await idOf('alice@student.fatima.edu.ph');
    const bobId = await idOf('bob@student.fatima.edu.ph');
    const danId = await idOf('dan@student.fatima.edu.ph');
    await Friend.create({ user: aliceId, friend: bobId, status: 'accepted' });
    await Friend.create({ user: aliceId, friend: danId, status: 'accepted' });
    const created = await alice.post('/api/schedules').send({ title: 'BSCS 2A' });
    return { alice, bob, carol, dan, aliceId, bobId, danId, schedule: created.body.schedule };
};

const invite = (alice, schedule, userId, role = 'editor') =>
    alice.post(`/api/schedules/${schedule._id}/share`).send({ userId, role });

describe('editing a shared schedule', () => {
    test('an invited editor can add, edit and remove entries and mark days off', async () => {
        const { alice, bob, bobId, schedule } = await setup();
        await invite(alice, schedule, bobId);
        const base = `/api/schedules/${schedule._id}`;

        const added = await bob.post(`${base}/entries`).send(entry());
        expect(added.status).toBe(201);
        expect(added.body.schedule.role).toBe('editor');
        const entryId = added.body.schedule.entries[0]._id;

        const edited = await bob.put(`${base}/entries/${entryId}`).send(entry({ title: 'Algorithms' }));
        expect(edited.body.schedule.entries[0].title).toBe('Algorithms');

        const day = await bob.put(`${base}/holidays`).send({ date: '2026-11-02', state: 'holiday', name: 'Class suspension' });
        expect(day.status).toBe(200);

        expect((await bob.delete(`${base}/entries/${entryId}`)).status).toBe(200);

        // Alice sees the schedule as it is now.
        const seen = await alice.get(base);
        expect(seen.body.schedule.entries).toHaveLength(0);
        expect(seen.body.schedule.holidayOverrides).toHaveLength(1);
    });

    test('editors cannot change settings, sharing, or delete the schedule', async () => {
        const { alice, bob, bobId, schedule } = await setup();
        await invite(alice, schedule, bobId);
        const base = `/api/schedules/${schedule._id}`;

        expect((await bob.put(base).send({ title: 'Mine now' })).status).toBe(403);
        expect((await bob.put(base).send({ isMain: true })).status).toBe(403);
        expect((await bob.put(`${base}/share-code`).send({ enabled: true })).status).toBe(403);
        expect((await bob.post(`${base}/share`).send({ userId: bobId })).status).toBe(403);
        expect((await bob.delete(base)).status).toBe(403);
        expect((await alice.get(base)).body.schedule.title).toBe('BSCS 2A');
    });

    test('strangers still cannot edit', async () => {
        const { alice, carol, bobId, schedule } = await setup();
        await invite(alice, schedule, bobId);
        expect((await carol.post(`/api/schedules/${schedule._id}/entries`).send(entry())).status).toBe(403);
    });

    test('the owner can promote a viewer and demote an editor', async () => {
        const { alice, bob, bobId, schedule } = await setup();
        await invite(alice, schedule, bobId, 'viewer');
        const base = `/api/schedules/${schedule._id}`;
        expect((await bob.post(`${base}/entries`).send(entry())).status).toBe(403);

        await invite(alice, schedule, bobId, 'editor');
        expect((await bob.post(`${base}/entries`).send(entry())).status).toBe(201);

        await invite(alice, schedule, bobId, 'viewer');
        expect((await bob.post(`${base}/entries`).send(entry({ title: 'Other' }))).status).toBe(403);
    });
});

describe('telling people what changed', () => {
    test('everyone else on the schedule is told, the editor is not', async () => {
        const { alice, bob, dan, aliceId, bobId, danId, schedule } = await setup();
        await invite(alice, schedule, bobId);
        await invite(alice, schedule, danId);
        await notificationModel.deleteMany({});

        await bob.post(`/api/schedules/${schedule._id}/entries`).send(entry({ title: 'Physics Lab' }));

        const forAlice = await notificationModel.find({ recipient: aliceId, type: 'schedule_change' });
        const forDan = await notificationModel.find({ recipient: danId, type: 'schedule_change' });
        const forBob = await notificationModel.find({ recipient: bobId, type: 'schedule_change' });
        expect(forAlice).toHaveLength(1);
        expect(forAlice[0].message).toBe('Bob added "Physics Lab"');
        expect(forAlice[0].link).toBe(`/schedule?s=${schedule._id}`);
        expect(forDan).toHaveLength(1);
        expect(forBob).toHaveLength(0);
        await dan.get('/api/notifications'); // inbox still loads with the new type
    });

    test('several unread changes fold into one notification with the latest on top', async () => {
        const { alice, bob, aliceId, bobId, schedule } = await setup();
        await invite(alice, schedule, bobId);
        await notificationModel.deleteMany({});
        const base = `/api/schedules/${schedule._id}`;

        await bob.post(`${base}/entries`).send(entry({ title: 'One' }));
        await bob.post(`${base}/entries`).send(entry({ title: 'Two' }));
        await bob.post(`${base}/entries`).send(entry({ title: 'Three' }));

        const notes = await notificationModel.find({ recipient: aliceId, type: 'schedule_change' });
        expect(notes).toHaveLength(1);
        expect(notes[0].count).toBe(3);
        expect(notes[0].message).toContain('Bob added "Three"');
        expect(notes[0].message).toContain('2 earlier changes');
    });

    test('a change log lists who did what, and the editor sees it too', async () => {
        const { alice, bob, bobId, schedule } = await setup();
        await invite(alice, schedule, bobId);
        const base = `/api/schedules/${schedule._id}`;

        const added = await bob.post(`${base}/entries`).send(entry({ title: 'Chemistry' }));
        const id = added.body.schedule.entries[0]._id;
        await alice.put(`${base}/entries/${id}`).send(entry({ title: 'Organic Chemistry' }));
        await bob.delete(`${base}/entries/${id}`);

        const log = (await bob.get(base)).body.schedule.activity;
        expect(log.map((a) => `${a.userName}: ${a.summary}`)).toEqual([
            'Bob: added "Chemistry"',
            'Alice: edited "Organic Chemistry" (was "Chemistry")',
            'Bob: removed "Organic Chemistry"',
        ]);
    });

    test('a rejected change is neither logged nor announced', async () => {
        const { alice, bob, aliceId, bobId, schedule } = await setup();
        await invite(alice, schedule, bobId);
        await notificationModel.deleteMany({});

        const bad = await bob.post(`/api/schedules/${schedule._id}/entries`).send(entry({ endTime: '08:00' }));
        expect(bad.status).toBe(400);
        expect(await notificationModel.countDocuments({ recipient: aliceId, type: 'schedule_change' })).toBe(0);
        expect((await alice.get(`/api/schedules/${schedule._id}`)).body.schedule.activity).toHaveLength(0);
    });

    test('a schedule nobody else can edit stays quiet', async () => {
        const { alice, bobId, schedule } = await setup();
        await invite(alice, schedule, bobId, 'viewer');
        await alice.post(`/api/schedules/${schedule._id}/entries`).send(entry());
        expect(await notificationModel.countDocuments({ type: 'schedule_change' })).toBe(0);
    });

    test('the log keeps only the latest 40 changes', async () => {
        const { alice, bob, bobId, schedule } = await setup();
        await invite(alice, schedule, bobId);
        const base = `/api/schedules/${schedule._id}`;
        for (let i = 0; i < 45; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            await bob.put(`${base}/holidays`).send({ date: '2026-11-02', state: i % 2 ? 'holiday' : 'workday' });
        }
        expect((await alice.get(base)).body.schedule.activity).toHaveLength(40);
    });

    test('members are told when the owner deletes it or an editor leaves', async () => {
        const { alice, bob, aliceId, bobId, schedule } = await setup();
        await invite(alice, schedule, bobId);
        await notificationModel.deleteMany({});

        await bob.delete(`/api/schedules/${schedule._id}/share/${bobId}`);
        const left = await notificationModel.findOne({ recipient: aliceId, type: 'schedule_change' });
        expect(left.message).toBe('Bob left the schedule.');

        await invite(alice, schedule, bobId);
        await notificationModel.deleteMany({});
        await alice.delete(`/api/schedules/${schedule._id}`);
        const gone = await notificationModel.findOne({ recipient: bobId, type: 'schedule_change' });
        expect(gone.message).toBe('Alice deleted "BSCS 2A".');
    });
});

describe('joining with a code and your own workload', () => {
    test('an editor code puts whoever enters it on the live schedule', async () => {
        const { alice, carol, schedule } = await setup();
        const on = await alice.put(`/api/schedules/${schedule._id}/share-code`).send({ enabled: true, role: 'editor' });
        const code = on.body.schedule.shareCode;
        expect(on.body.schedule.shareRole).toBe('editor');

        const preview = await carol.post('/api/schedules/preview').send({ shareCode: code });
        expect(preview.body.source.canJoinLive).toBe(true);

        const joined = await carol.post('/api/schedules/join').send({ shareCode: code });
        expect(joined.body.schedule.role).toBe('editor');
        expect((await carol.post(`/api/schedules/${schedule._id}/entries`).send(entry())).status).toBe(201);
    });

    test('members only see other editors, never plain viewers or the code', async () => {
        const { alice, bob, dan, bobId, danId, schedule } = await setup();
        await invite(alice, schedule, bobId, 'editor');
        await invite(alice, schedule, danId, 'viewer');

        const seen = (await bob.get(`/api/schedules/${schedule._id}`)).body.schedule;
        expect(seen.live).toBe(true);
        expect(seen.collaborators.map((c) => c.user.name)).toEqual(['Bob']);
        expect(seen.shareCode).toBeUndefined();
        void dan;
    });

    test('a shared schedule only counts toward a member\'s week once they opt in', async () => {
        const { alice, bob, bobId, schedule } = await setup();
        await invite(alice, schedule, bobId);
        await alice.post(`/api/schedules/${schedule._id}/entries`).send(entry({ days: [1], startTime: '09:00', endTime: '11:00' }));

        const week = async () => (await bob.get('/api/schedules/week?start=2026-10-05')).body;
        expect((await week()).scheduleCount).toBe(0);

        const on = await bob.put(`/api/schedules/${schedule._id}/membership`).send({ countInWorkload: true });
        expect(on.body.schedule.myCountInWorkload).toBe(true);
        const counted = await week();
        expect(counted.scheduleCount).toBe(1);
        expect(counted.days[0].classHours).toBe(2);

        const list = await bob.get('/api/schedules');
        expect(list.body.schedules[0]).toMatchObject({ role: 'editor', live: true, countInWorkload: true });

        await bob.put(`/api/schedules/${schedule._id}/membership`).send({ countInWorkload: false });
        expect((await week()).scheduleCount).toBe(0);
    });

    test('the owner cannot use the membership setting', async () => {
        const { alice, schedule } = await setup();
        expect((await alice.put(`/api/schedules/${schedule._id}/membership`).send({ countInWorkload: true })).status).toBe(400);
    });
});
