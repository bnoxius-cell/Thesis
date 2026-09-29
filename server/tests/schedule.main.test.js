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
vi.mock('../utils/holidays.js', () => ({ fetchPublicHolidays: vi.fn() }));

beforeAll(connectTestDB);
beforeEach(async () => {
    await clearTestDB();
    fetchPublicHolidays.mockReset();
    fetchPublicHolidays.mockResolvedValue([]);
});
afterAll(closeTestDB);

const signUp = async (email, name) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email, name }));
    return agent;
};
const idOf = async (email) => (await userModel.findOne({ email }))._id.toString();

const cls = (overrides = {}) => ({ title: 'Data Structures', kind: 'class', days: [1, 3], startTime: '09:00', endTime: '10:30', ...overrides });
const isoIn = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const todayIso = () => isoIn(0);

const setup = async () => {
    const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
    const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
    const aliceId = await idOf('alice@student.fatima.edu.ph');
    const bobId = await idOf('bob@student.fatima.edu.ph');
    await Friend.create({ user: aliceId, friend: bobId, status: 'accepted' });
    return { alice, bob, aliceId, bobId };
};
const create = async (agent, title) => (await agent.post('/api/schedules').send({ title })).body.schedule;

describe('one main schedule', () => {
    test('the first schedule is the main one and later ones are extras', async () => {
        const { alice } = await setup();
        const main = await create(alice, 'My timetable');
        const gym = await create(alice, 'Gym');
        expect(main.isMain).toBe(true);
        expect(gym.isMain).toBe(false);

        const list = await alice.get('/api/schedules');
        expect(list.body.schedules.filter((s) => s.isMain)).toHaveLength(1);
    });

    test('there is a limit on how many extras you can have', async () => {
        const { alice } = await setup();
        for (let i = 0; i < 5; i += 1) expect((await alice.post('/api/schedules').send({ title: `S${i}` })).status).toBe(201);
        const over = await alice.post('/api/schedules').send({ title: 'One too many' });
        expect(over.status).toBe(400);
    });

    test('an older account with several schedules and no main gets its oldest promoted', async () => {
        const { alice, aliceId } = await setup();
        const first = await scheduleModel.create({ title: 'Old one', owner: aliceId });
        await scheduleModel.create({ title: 'Newer', owner: aliceId });

        const list = await alice.get('/api/schedules');
        const mains = list.body.schedules.filter((s) => s.isMain);
        expect(mains).toHaveLength(1);
        expect(mains[0]._id).toBe(first._id.toString());
    });

    test('you can make another schedule your main, and only one is ever main', async () => {
        const { alice } = await setup();
        const main = await create(alice, 'Main');
        const gym = await create(alice, 'Gym');

        const res = await alice.put(`/api/schedules/${gym._id}`).send({ isMain: true });
        expect(res.body.schedule.isMain).toBe(true);
        const list = await alice.get('/api/schedules');
        expect(list.body.schedules.find((s) => s._id === main._id).isMain).toBe(false);
        expect(list.body.schedules.filter((s) => s.isMain)).toHaveLength(1);
    });

    test('the main schedule cannot be deleted while extras exist', async () => {
        const { alice } = await setup();
        const main = await create(alice, 'Main');
        const gym = await create(alice, 'Gym');

        expect((await alice.delete(`/api/schedules/${main._id}`)).status).toBe(400);
        expect((await alice.delete(`/api/schedules/${gym._id}`)).status).toBe(200);
        expect((await alice.delete(`/api/schedules/${main._id}`)).status).toBe(200);
    });

    test('GET /main returns the main schedule, or null', async () => {
        const { alice } = await setup();
        expect((await alice.get('/api/schedules/main')).body.schedule).toBeNull();
        const main = await create(alice, 'Main');
        expect((await alice.get('/api/schedules/main')).body.schedule._id).toBe(main._id);
    });

    test('the week counts the main schedule plus extras that are switched on', async () => {
        const { alice } = await setup();
        const main = await create(alice, 'Main');
        const gym = await create(alice, 'Gym');
        await alice.post(`/api/schedules/${main._id}/entries`).send(cls({ days: [0, 1, 2, 3, 4, 5, 6], startTime: '08:00', endTime: '09:00' }));
        await alice.post(`/api/schedules/${gym._id}/entries`).send(cls({ title: 'Gym', kind: 'activity', days: [0, 1, 2, 3, 4, 5, 6], startTime: '17:00', endTime: '18:00' }));

        const both = await alice.get(`/api/schedules/week?start=${todayIso()}`);
        expect(both.body.days[0].busyHours).toBe(2);

        await alice.put(`/api/schedules/${gym._id}`).send({ countInWorkload: false });
        const mainOnly = await alice.get(`/api/schedules/week?start=${todayIso()}`);
        expect(mainOnly.body.days[0].busyHours).toBe(1);
    });

    test('copied entries go into the main schedule by default', async () => {
        const { alice, bob } = await setup();
        const shared = await create(alice, 'Alice classes');
        await alice.post(`/api/schedules/${shared._id}/entries`).send(cls());
        const code = (await alice.put(`/api/schedules/${shared._id}/share-code`).send({ enabled: true })).body.schedule.shareCode;

        const bobMain = await create(bob, 'Bob main');
        const preview = await bob.post('/api/schedules/preview').send({ shareCode: code });
        const res = await bob.post('/api/schedules/import').send({
            shareCode: code, selections: [{ id: preview.body.entries[0]._id }],
        });
        expect(res.body.schedule._id).toBe(bobMain._id);
        expect(res.body.schedule.entries).toHaveLength(1);
        expect((await bob.get('/api/schedules')).body.schedules).toHaveLength(1);
    });

    test('someone with no schedule yet gets the copy as their main, and can ask for an extra instead', async () => {
        const { alice, bob } = await setup();
        const shared = await create(alice, 'Alice classes');
        await alice.post(`/api/schedules/${shared._id}/entries`).send(cls());
        const code = (await alice.put(`/api/schedules/${shared._id}/share-code`).send({ enabled: true })).body.schedule.shareCode;
        const preview = await bob.post('/api/schedules/preview').send({ shareCode: code });
        const selections = [{ id: preview.body.entries[0]._id }];

        const first = await bob.post('/api/schedules/import').send({ shareCode: code, selections });
        expect(first.body.schedule.isMain).toBe(true);

        const extra = await bob.post('/api/schedules/import').send({ shareCode: code, selections, newSchedule: true, title: 'Alice copy' });
        expect(extra.body.schedule.isMain).toBe(false);
        expect(extra.body.schedule.title).toBe('Alice copy');
    });
});

describe('exams and events', () => {
    test('an exam needs a date and keeps its study hours', async () => {
        const { alice } = await setup();
        const main = await create(alice, 'Main');
        const url = `/api/schedules/${main._id}/entries`;

        const noDate = await alice.post(url).send({ title: 'Finals', kind: 'exam', startTime: '09:00', endTime: '11:00', days: [1] });
        expect(noDate.status).toBe(400);

        const ok = await alice.post(url).send({ title: 'Finals', kind: 'exam', date: isoIn(5), startTime: '09:00', endTime: '11:00', prepHours: 6 });
        expect(ok.status).toBe(201);
        const entry = ok.body.schedule.entries[0];
        expect(entry.kind).toBe('exam');
        expect(entry.prepHours).toBe(6);
        expect(entry.skipOnHoliday).toBe(false);
    });

    test('study hours default to 4 and must be sensible', async () => {
        const { alice } = await setup();
        const main = await create(alice, 'Main');
        const url = `/api/schedules/${main._id}/entries`;
        const def = await alice.post(url).send({ title: 'Quiz', kind: 'exam', date: isoIn(2), startTime: '09:00', endTime: '10:00' });
        expect(def.body.schedule.entries[0].prepHours).toBe(4);
        const bad = await alice.post(url).send({ title: 'Quiz', kind: 'exam', date: isoIn(2), startTime: '09:00', endTime: '10:00', prepHours: 99 });
        expect(bad.status).toBe(400);
    });

    test('events can repeat and do not skip holidays', async () => {
        const { alice } = await setup();
        const main = await create(alice, 'Main');
        const res = await alice.post(`/api/schedules/${main._id}/entries`).send({ title: 'Org meeting', kind: 'event', days: [5], startTime: '15:00', endTime: '16:00' });
        expect(res.body.schedule.entries[0].kind).toBe('event');
        expect(res.body.schedule.entries[0].skipOnHoliday).toBe(false);
    });

    test('the week overview lists upcoming exams and counts them as busy time', async () => {
        const { alice } = await setup();
        const main = await create(alice, 'Main');
        await alice.post(`/api/schedules/${main._id}/entries`).send({ title: 'Calculus midterm', kind: 'exam', date: isoIn(0), startTime: '09:00', endTime: '11:00', prepHours: 5 });
        await alice.post(`/api/schedules/${main._id}/entries`).send({ title: 'Far exam', kind: 'exam', date: isoIn(40), startTime: '09:00', endTime: '11:00' });

        const res = await alice.get(`/api/schedules/week?start=${todayIso()}`);
        expect(res.body.upcomingExams).toHaveLength(1);
        expect(res.body.upcomingExams[0]).toMatchObject({ title: 'Calculus midterm', prepHours: 5 });
        expect(res.body.days[0].busyHours).toBe(2);
        expect(res.body.days[0].entries[0].kind).toBe('exam');
    });

    test('the same exam in two of your schedules is listed once', async () => {
        const { alice } = await setup();
        const main = await create(alice, 'Main');
        const extra = await create(alice, 'Extra');
        const exam = { title: 'Finals', kind: 'exam', date: isoIn(3), startTime: '09:00', endTime: '11:00' };
        await alice.post(`/api/schedules/${main._id}/entries`).send(exam);
        await alice.post(`/api/schedules/${extra._id}/entries`).send(exam);
        const res = await alice.get(`/api/schedules/week?start=${todayIso()}`);
        expect(res.body.upcomingExams).toHaveLength(1);
    });
});

describe('sharing a schedule with a friend', () => {
    test('the friend is told, sees it as view-only, and nothing is added to theirs until they choose', async () => {
        const { alice, bob, aliceId, bobId } = await setup();
        const bobMain = await create(bob, 'Bob main');
        const shared = await create(alice, 'Section A');
        await alice.post(`/api/schedules/${shared._id}/entries`).send(cls());
        await alice.post(`/api/schedules/${shared._id}/share`).send({ userId: bobId });

        const note = await notificationModel.findOne({ type: 'schedule_share' });
        expect(note.link).toBe(`/schedule?share=${shared._id}`);
        expect(String(note.sender)).toBe(aliceId);

        const bobList = await bob.get('/api/schedules');
        expect(bobList.body.schedules.find((s) => s._id === shared._id).role).toBe('viewer');
        const bobMainNow = await bob.get(`/api/schedules/${bobMain._id}`);
        expect(bobMainNow.body.schedule.entries).toHaveLength(0);
        // A shared schedule never counts toward the friend's week.
        expect((await bob.get(`/api/schedules/week?start=${todayIso()}`)).body.entryCount).toBe(0);
    });

    test('the friend can preview and copy it straight from the share, editing what they like', async () => {
        const { alice, bob, bobId } = await setup();
        const bobMain = await create(bob, 'Bob main');
        const shared = await create(alice, 'Section A');
        await alice.post(`/api/schedules/${shared._id}/entries`).send(cls({ title: 'Physics', startTime: '08:00', endTime: '09:00' }));
        await alice.post(`/api/schedules/${shared._id}/share`).send({ userId: bobId });

        const preview = await bob.post('/api/schedules/preview').send({ scheduleId: shared._id });
        expect(preview.body.success).toBe(true);
        expect(preview.body.source.ownerName).toBe('Alice');

        const res = await bob.post('/api/schedules/import').send({
            scheduleId: shared._id,
            selections: [{ id: preview.body.entries[0]._id, edits: { startTime: '13:00', endTime: '14:00' } }],
        });
        expect(res.body.schedule._id).toBe(bobMain._id);
        expect(res.body.schedule.entries[0]).toMatchObject({ title: 'Physics', startTime: '13:00' });

        // Alice's original is untouched.
        const original = await alice.get(`/api/schedules/${shared._id}`);
        expect(original.body.schedule.entries[0].startTime).toBe('08:00');
    });

    test('editing your copy never changes the original', async () => {
        const { alice, bob, bobId } = await setup();
        const bobMain = await create(bob, 'Bob main');
        const shared = await create(alice, 'Section A');
        await alice.post(`/api/schedules/${shared._id}/entries`).send(cls());
        await alice.post(`/api/schedules/${shared._id}/share`).send({ userId: bobId });
        const preview = await bob.post('/api/schedules/preview').send({ scheduleId: shared._id });
        const added = await bob.post('/api/schedules/import').send({ scheduleId: shared._id, selections: [{ id: preview.body.entries[0]._id }] });

        const copyEntry = added.body.schedule.entries[0];
        const edit = await bob.put(`/api/schedules/${bobMain._id}/entries/${copyEntry._id}`).send(cls({ title: 'My own version' }));
        expect(edit.status).toBe(200);
        expect((await alice.get(`/api/schedules/${shared._id}`)).body.schedule.entries[0].title).toBe('Data Structures');
    });

    test('nobody else can change your schedule, however they got to it', async () => {
        const { alice, bob, bobId } = await setup();
        const carol = await signUp('carol@student.fatima.edu.ph', 'Carol');
        const shared = await create(alice, 'Section A');
        const added = await alice.post(`/api/schedules/${shared._id}/entries`).send(cls());
        const entryId = added.body.schedule.entries[0]._id;
        await alice.post(`/api/schedules/${shared._id}/share`).send({ userId: bobId });
        const code = (await alice.put(`/api/schedules/${shared._id}/share-code`).send({ enabled: true })).body.schedule.shareCode;
        await carol.post('/api/schedules/join').send({ shareCode: code });

        const base = `/api/schedules/${shared._id}`;
        for (const who of [bob, carol]) {
            expect((await who.put(`${base}/entries/${entryId}`).send(cls({ title: 'Hacked' }))).status).toBe(403);
            expect((await who.delete(`${base}/entries/${entryId}`)).status).toBe(403);
            expect((await who.post(`${base}/entries`).send(cls())).status).toBe(403);
            expect((await who.put(base).send({ title: 'Hacked', isMain: true })).status).toBe(403);
            expect((await who.put(`${base}/holidays`).send({ date: isoIn(1), state: 'holiday' })).status).toBe(403);
            expect((await who.delete(base)).status).toBe(403);
        }
        const after = await alice.get(base);
        expect(after.body.schedule.title).toBe('Section A');
        expect(after.body.schedule.entries[0].title).toBe('Data Structures');
    });

    test('a stranger cannot preview a schedule that was not shared with them', async () => {
        const { alice } = await setup();
        const carol = await signUp('carol@student.fatima.edu.ph', 'Carol');
        const private_ = await create(alice, 'Private');
        await alice.post(`/api/schedules/${private_._id}/entries`).send(cls());
        const res = await carol.post('/api/schedules/preview').send({ scheduleId: private_._id });
        expect(res.status).toBe(404);
    });

    test('previewing your own schedule by id is refused', async () => {
        const { alice } = await setup();
        const mine = await create(alice, 'Mine');
        expect((await alice.post('/api/schedules/preview').send({ scheduleId: mine._id })).status).toBe(400);
    });

    test('exams come along when a schedule is copied', async () => {
        const { alice, bob, bobId } = await setup();
        const shared = await create(alice, 'Section A');
        await alice.post(`/api/schedules/${shared._id}/entries`).send({ title: 'Finals', kind: 'exam', date: isoIn(6), startTime: '09:00', endTime: '11:00', prepHours: 8 });
        await alice.post(`/api/schedules/${shared._id}/share`).send({ userId: bobId });
        const preview = await bob.post('/api/schedules/preview').send({ scheduleId: shared._id });
        const added = await bob.post('/api/schedules/import').send({ scheduleId: shared._id, selections: [{ id: preview.body.entries[0]._id }] });
        expect(added.body.schedule.entries[0]).toMatchObject({ kind: 'exam', prepHours: 8 });
    });
});
