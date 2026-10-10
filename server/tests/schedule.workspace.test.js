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
const befriend = (a, b) => Friend.create({ user: a, friend: b, status: 'accepted' });

const cls = (overrides = {}) => ({
    title: 'Data Structures', kind: 'class', days: [1, 3], startTime: '09:00', endTime: '10:30', ...overrides,
});

// Alice owns "BSCS 2A". Bob is her friend and an editor. Dan is Bob's friend, not Alice's.
// Carol is nobody's friend.
const setup = async () => {
    const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
    const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
    const carol = await signUp('carol@student.fatima.edu.ph', 'Carol');
    const dan = await signUp('dan@student.fatima.edu.ph', 'Dan');
    const aliceId = await idOf('alice@student.fatima.edu.ph');
    const bobId = await idOf('bob@student.fatima.edu.ph');
    const carolId = await idOf('carol@student.fatima.edu.ph');
    const danId = await idOf('dan@student.fatima.edu.ph');
    await befriend(aliceId, bobId);
    await befriend(bobId, danId);
    const created = await alice.post('/api/schedules').send({ title: 'BSCS 2A' });
    const schedule = created.body.schedule;
    await alice.post(`/api/schedules/${schedule._id}/share`).send({ userId: bobId, role: 'editor' });
    return { alice, bob, carol, dan, aliceId, bobId, carolId, danId, schedule, base: `/api/schedules/${schedule._id}` };
};

describe('online class links', () => {
    test('a class keeps its Google Meet or Zoom link', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const { body } = await alice.post('/api/schedules').send({ title: 'Online term' });
        const res = await alice.post(`/api/schedules/${body.schedule._id}/entries`)
            .send(cls({ meetingUrl: '  https://meet.google.com/abc-defg-hij  ' }));

        expect(res.status).toBe(201);
        expect(res.body.schedule.entries[0].meetingUrl).toBe('https://meet.google.com/abc-defg-hij');

        const zoom = await alice.put(`/api/schedules/${body.schedule._id}/entries/${res.body.schedule.entries[0]._id}`)
            .send(cls({ meetingUrl: 'https://us02web.zoom.us/j/123456789?pwd=abc' }));
        expect(zoom.body.schedule.entries[0].meetingUrl).toBe('https://us02web.zoom.us/j/123456789?pwd=abc');

        const cleared = await alice.put(`/api/schedules/${body.schedule._id}/entries/${res.body.schedule.entries[0]._id}`)
            .send(cls({ meetingUrl: '' }));
        expect(cleared.body.schedule.entries[0].meetingUrl).toBe('');
    });

    test('only full web links are accepted, so a Join button can never run script', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const { body } = await alice.post('/api/schedules').send({ title: 'Online term' });
        const url = `/api/schedules/${body.schedule._id}/entries`;

        for (const meetingUrl of ['javascript:alert(1)', 'meet.google.com/abc', 'zoommtg://zoom.us/join', `https://x.com/${'a'.repeat(300)}`]) {
            const res = await alice.post(url).send(cls({ meetingUrl }));
            expect(res.status, meetingUrl).toBe(400);
        }
    });

    test('the link reaches the dashboard week and travels with a copy', async () => {
        const { alice, bob, base } = await setup();
        await alice.post(`${base}/entries`).send(cls({ days: [0, 1, 2, 3, 4, 5, 6], meetingUrl: 'https://meet.google.com/abc-defg-hij' }));

        const week = await alice.get('/api/schedules/week?start=2026-10-05');
        expect(week.body.days[0].entries[0].meetingUrl).toBe('https://meet.google.com/abc-defg-hij');

        const copy = await bob.post(`${base}/duplicate`).send({});
        expect(copy.body.schedule.entries[0].meetingUrl).toBe('https://meet.google.com/abc-defg-hij');
    });
});

describe('holidays are always the Philippines', () => {
    test('there is no country to pick, and the week overview asks for PH', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const { body } = await alice.post('/api/schedules').send({ title: 'Term', country: 'US' });
        expect(body.schedule.country).toBeUndefined();
        await alice.post(`/api/schedules/${body.schedule._id}/entries`).send(cls());

        await alice.get('/api/schedules/week?start=2026-12-28');
        expect(fetchPublicHolidays).toHaveBeenCalledWith(2026, 'PH');
        expect(fetchPublicHolidays).toHaveBeenCalledWith(2027, 'PH');
        expect(fetchPublicHolidays.mock.calls.every(([, country]) => country === 'PH')).toBe(true);
    });
});

describe('changing several days off at once', () => {
    test('marks a whole break with one name and logs it as one change', async () => {
        const { alice, base } = await setup();
        const dates = ['2026-12-21', '2026-12-22', '2026-12-23'];
        const res = await alice.put(`${base}/holidays`).send({
            changes: dates.map((date) => ({ date, state: 'holiday', name: 'Christmas break' })),
        });

        expect(res.status).toBe(200);
        expect(res.body.schedule.holidayOverrides).toEqual(dates.map((date) => ({ date, state: 'holiday', name: 'Christmas break' })));
        expect(res.body.schedule.activity).toHaveLength(1);
        expect(res.body.schedule.activity[0].summary).toBe('marked 3 days off (2026-12-21 to 2026-12-23)');
    });

    test('removes and resets in the same request', async () => {
        const { alice, base } = await setup();
        await alice.put(`${base}/holidays`).send({ date: '2026-12-21', state: 'holiday', name: 'Break' });

        const res = await alice.put(`${base}/holidays`).send({
            changes: [{ date: '2026-12-21', state: null }, { date: '2026-12-25', state: 'workday' }],
        });
        expect(res.body.schedule.holidayOverrides).toEqual([{ date: '2026-12-25', state: 'workday', name: '' }]);
    });

    test('rejects bad dates, repeated dates and too many days', async () => {
        const { alice, base } = await setup();
        const bad = [
            { changes: [] },
            { changes: [{ date: '2026-02-30', state: 'holiday' }] },
            { changes: [{ date: '2026-12-21', state: 'holiday' }, { date: '2026-12-21', state: null }] },
            { changes: [{ date: '2026-12-21', state: 'maybe' }] },
            { changes: Array.from({ length: 121 }, (_, i) => ({ date: `2026-01-01`.replace('01-01', `0${1 + Math.floor(i / 28)}-${String(1 + (i % 28)).padStart(2, '0')}`), state: 'holiday' })) },
        ];
        for (const body of bad) {
            expect((await alice.put(`${base}/holidays`).send(body)).status).toBe(400);
        }
        const viewer = await signUp('vee@student.fatima.edu.ph', 'Vee');
        expect((await viewer.put(`${base}/holidays`).send({ changes: [{ date: '2026-12-21', state: 'holiday' }] })).status).toBe(403);
    });
});

describe('who can share', () => {
    test('editors cannot share until the owner lets them', async () => {
        const { alice, bob, danId, base } = await setup();

        const blocked = await bob.post(`${base}/share`).send({ userId: danId, role: 'viewer' });
        expect(blocked.status).toBe(403);
        expect((await bob.get(base)).body.schedule).toMatchObject({ canShare: false });
        expect((await bob.get(base)).body.schedule.shareCode).toBeUndefined();

        // Only the owner flips the switch.
        expect((await bob.put(base).send({ editorsCanShare: true })).status).toBe(403);
        const on = await alice.put(base).send({ editorsCanShare: true });
        expect(on.body.schedule.editorsCanShare).toBe(true);

        const shared = await bob.post(`${base}/share`).send({ userId: danId, role: 'viewer' });
        expect(shared.status).toBe(200);
        expect(shared.body.schedule.canShare).toBe(true);
        expect(shared.body.schedule.collaborators.map((c) => [c.user.name, c.role])).toEqual([['Bob', 'editor'], ['Dan', 'viewer']]);

        const note = await notificationModel.findOne({ recipient: danId, type: 'schedule_share' });
        expect(note.message).toContain('Bob shared the schedule "BSCS 2A"');
        expect(note.link).toBe(`/schedule?s=${shared.body.schedule._id}`);
    });

    test('an editor who can share manages roles, the code and removals, but not the owner settings', async () => {
        const { alice, bob, dan, danId, base } = await setup();
        await alice.put(base).send({ editorsCanShare: true });
        await bob.post(`${base}/share`).send({ userId: danId, role: 'viewer' });

        expect((await bob.post(`${base}/share`).send({ userId: danId, role: 'editor' })).body.schedule.collaborators[1].role).toBe('editor');
        const code = await bob.put(`${base}/share-code`).send({ enabled: true, role: 'viewer' });
        expect(code.body.schedule.shareCode).toMatch(/^[A-Z2-9]{6}$/);
        expect(code.body.schedule.access).toEqual({ people: 2, link: 'viewer' });

        expect((await bob.delete(`${base}/share/${danId}`)).status).toBe(200);
        expect((await dan.get(base)).status).toBe(403);

        expect((await bob.post(`${base}/make-private`)).status).toBe(403);
        expect((await bob.delete(base)).status).toBe(403);
        expect((await bob.put(base).send({ title: 'Mine now' })).status).toBe(403);
    });

    test('new people must be friends of whoever shares, and nobody can add the owner', async () => {
        const { alice, bob, aliceId, carolId, base } = await setup();
        await alice.put(base).send({ editorsCanShare: true });

        expect((await bob.post(`${base}/share`).send({ userId: carolId })).status).toBe(403);
        expect((await bob.post(`${base}/share`).send({ userId: aliceId })).status).toBe(400);
    });

    test('a viewer never manages sharing', async () => {
        const { alice, bob, dan, danId, bobId, base } = await setup();
        await alice.put(base).send({ editorsCanShare: true });
        await bob.post(`${base}/share`).send({ userId: danId, role: 'viewer' });

        expect((await dan.post(`${base}/share`).send({ userId: bobId, role: 'viewer' })).status).toBe(403);
        expect((await dan.put(`${base}/share-code`).send({ enabled: true })).status).toBe(403);
        expect((await dan.delete(`${base}/share/${bobId}`)).status).toBe(403);
        // Leaving is always allowed.
        expect((await dan.delete(`${base}/share/${danId}`)).status).toBe(200);
    });
});

describe('making a schedule private', () => {
    test('removes everyone, turns the code off and tells them', async () => {
        const { alice, bob, carol, bobId, base, schedule } = await setup();
        const { body } = await alice.put(`${base}/share-code`).send({ enabled: true });
        await carol.post('/api/schedules/join').send({ shareCode: body.schedule.shareCode });

        const res = await alice.post(`${base}/make-private`);
        expect(res.status).toBe(200);
        expect(res.body.removed).toBe(2);
        expect(res.body.schedule.collaborators).toEqual([]);
        expect(res.body.schedule.shareCode).toBeUndefined();
        expect(res.body.schedule.access).toEqual({ people: 0, link: 'restricted' });

        expect((await bob.get(base)).status).toBe(403);
        expect((await carol.post('/api/schedules/join').send({ shareCode: body.schedule.shareCode })).status).toBe(404);
        const note = await notificationModel.findOne({ recipient: bobId, title: 'A schedule is now private' });
        expect(note.message).toContain('"BSCS 2A" private');

        const list = await alice.get('/api/schedules');
        expect(list.body.schedules.find((s) => s._id === schedule._id).private).toBe(true);
    });
});

describe('the change check the open page polls', () => {
    test('moves forward when someone edits, and is closed to strangers', async () => {
        const { alice, bob, carol, base } = await setup();
        const before = await alice.get(`${base}/stamp`);
        expect(before.body).toMatchObject({ success: true, role: 'owner' });

        await new Promise((r) => setTimeout(r, 15));
        await bob.post(`${base}/entries`).send(cls());
        const after = await alice.get(`${base}/stamp`);
        expect(new Date(after.body.updatedAt) > new Date(before.body.updatedAt)).toBe(true);
        expect((await bob.get(`${base}/stamp`)).body.role).toBe('editor');

        expect((await carol.get(`${base}/stamp`)).status).toBe(403);
        expect((await carol.get('/api/schedules/nope/stamp')).status).toBe(404);
    });
});

describe('opening a schedule with a code or link', () => {
    test('a view code puts the person on the schedule as a viewer who sees changes', async () => {
        const { alice, carol, carolId, base } = await setup();
        const { body } = await alice.put(`${base}/share-code`).send({ enabled: true, role: 'viewer' });
        const shareCode = body.schedule.shareCode;

        const preview = await carol.post('/api/schedules/preview').send({ shareCode });
        expect(preview.body.source).toMatchObject({ codeRole: 'viewer', canJoinLive: false });
        expect(preview.body.source.memberRole).toBeUndefined();

        const joined = await carol.post('/api/schedules/join').send({ shareCode });
        expect(joined.body.schedule.role).toBe('viewer');
        const again = await carol.post('/api/schedules/preview').send({ shareCode });
        expect(again.body.source.memberRole).toBe('viewer');

        await alice.post(`${base}/entries`).send(cls({ title: 'New class' }));
        expect((await carol.get(base)).body.schedule.entries.map((e) => e.title)).toEqual(['New class']);
        expect((await scheduleModel.findById(body.schedule._id)).collaborators.some((c) => c.user.toString() === carolId)).toBe(true);
    });

    test('an edit code moves a viewer up, and never moves anyone down', async () => {
        const { alice, bob, carol, base } = await setup();
        const viewCode = (await alice.put(`${base}/share-code`).send({ enabled: true, role: 'viewer' })).body.schedule.shareCode;
        await carol.post('/api/schedules/join').send({ shareCode: viewCode });
        // Bob is an editor already. A view code must not demote him.
        expect((await bob.post('/api/schedules/join').send({ shareCode: viewCode })).body.schedule.role).toBe('editor');

        await alice.put(`${base}/share-code`).send({ role: 'editor' });
        expect((await carol.post('/api/schedules/join').send({ shareCode: viewCode })).body.schedule.role).toBe('editor');
    });
});

describe('making a copy', () => {
    test('anyone on it can make a private copy with their own name for it', async () => {
        const { alice, bob, base } = await setup();
        await alice.post(`${base}/entries`).send(cls());

        const copy = await bob.post(`${base}/duplicate`).send({ title: 'My BSCS 2A' });
        expect(copy.status).toBe(201);
        expect(copy.body.schedule).toMatchObject({ title: 'My BSCS 2A', role: 'owner', collaborators: [], access: { people: 0, link: 'restricted' } });
        expect(copy.body.schedule.entries).toHaveLength(1);

        const own = await alice.post(`${base}/duplicate`).send({});
        expect(own.body.schedule).toMatchObject({ title: 'Copy of BSCS 2A', isMain: false });
    });
});
