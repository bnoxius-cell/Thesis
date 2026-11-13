import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import userModel from '../models/userModel.js';
import Friend from '../models/Friend.js';
import scheduleModel from '../models/scheduleModel.js';
import subjectModel, { SUBJECT_LIMITS, SUBJECT_COLORS } from '../models/subjectModel.js';
import { entrySubjectFor, subjectInTitle } from '../utils/subjectMatch.js';
import { entrySubject as clientEntrySubject } from '../../client/src/features/details/itemLinks.js';
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
beforeEach(clearTestDB);
afterAll(closeTestDB);

const signUp = async (email, name) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email, name }));
    return agent;
};
const idOf = async (email) => (await userModel.findOne({ email }))._id.toString();

const cls = (overrides = {}) => ({ kind: 'class', days: [1, 3], startTime: '09:00', endTime: '10:30', ...overrides });
const exam = (overrides = {}) => ({ kind: 'exam', title: 'Midterm', date: '2099-03-02', startTime: '09:00', endTime: '10:30', ...overrides });
const monday = '2099-03-02';

const makeSubject = async (agent, name, extra = {}) => (await agent.post('/api/subjects').send({ name, ...extra })).body.subject;
const storedEntries = async (scheduleId) => (await scheduleModel.findById(scheduleId).lean()).entries;

// Alice owns "BSCS 2A" with Bob as an editor and Cara as a viewer. Each has their own subjects.
const setup = async () => {
    const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
    const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
    const cara = await signUp('cara@student.fatima.edu.ph', 'Cara');
    const [aliceId, bobId, caraId] = await Promise.all(['alice', 'bob', 'cara'].map((n) => idOf(`${n}@student.fatima.edu.ph`)));
    await Friend.create({ user: aliceId, friend: bobId, status: 'accepted' });
    await Friend.create({ user: aliceId, friend: caraId, status: 'accepted' });
    const schedule = (await alice.post('/api/schedules').send({ title: 'BSCS 2A' })).body.schedule;
    const base = `/api/schedules/${schedule._id}`;
    await alice.post(`${base}/share`).send({ userId: bobId, role: 'editor' });
    await alice.post(`${base}/share`).send({ userId: caraId, role: 'viewer' });
    return { alice, bob, cara, aliceId, bobId, caraId, schedule, base };
};

describe('owner writes a class with a subject', () => {
    test('a subject id is stored and the title becomes the subject name', async () => {
        const { alice, base } = await setup();
        const web = await makeSubject(alice, 'Web Systems');
        const res = await alice.post(`${base}/entries`).send(cls({ subject: web._id, title: 'something else' }));
        expect(res.status).toBe(201);
        expect(res.body.subject).toBeUndefined();
        const [entry] = res.body.schedule.entries;
        expect(entry).toMatchObject({ title: 'Web Systems', subject: web._id });
        expect(String((await storedEntries(res.body.schedule._id))[0].subject)).toBe(web._id);
    });

    test("another user's subject id is refused", async () => {
        const { alice, bob, base } = await setup();
        const theirs = await makeSubject(bob, 'Bob Only');
        const res = await alice.post(`${base}/entries`).send(cls({ subject: theirs._id }));
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Pick one of your subjects.');
    });

    test('an archived subject cannot be picked', async () => {
        const { alice, base } = await setup();
        const old = await makeSubject(alice, 'Old Course');
        await subjectModel.updateOne({ _id: old._id }, { archivedAt: new Date() });
        expect((await alice.post(`${base}/entries`).send(cls({ subject: old._id }))).status).toBe(400);
    });

    test('newSubject creates the subject, links it and answers with it', async () => {
        const { alice } = await setup();
        const res = await alice.post('/api/schedules/main/entries').send(cls({ newSubject: 'Data Mining' }));
        expect(res.status).toBe(201);
        expect(res.body.subject).toMatchObject({ name: 'Data Mining' });
        expect(res.body.schedule.entries[0]).toMatchObject({ title: 'Data Mining', subject: res.body.subject._id });
        const list = await alice.get('/api/subjects');
        expect(list.body.subjects.map((s) => s.name)).toEqual(['Data Mining']);
    });

    test('newSubject reuses a subject with the same name in another case', async () => {
        const { alice, base } = await setup();
        const web = await makeSubject(alice, 'Web Systems');
        const res = await alice.post(`${base}/entries`).send(cls({ newSubject: 'web  systems' }));
        expect(res.status).toBe(201);
        expect(res.body.subject).toBeUndefined();
        expect(res.body.schedule.entries[0]).toMatchObject({ title: 'Web Systems', subject: web._id });
        expect(await subjectModel.countDocuments()).toBe(1);
    });

    test('newSubject past the cap is refused', async () => {
        const { alice, aliceId, base } = await setup();
        await subjectModel.insertMany(Array.from({ length: SUBJECT_LIMITS.maxActive }, (_, i) => ({
            owner: aliceId, name: `Subject ${i}`, color: SUBJECT_COLORS[0], order: i,
        })));
        const res = await alice.post(`${base}/entries`).send(cls({ newSubject: 'One too many' }));
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/up to 30 subjects/);
    });

    test('an invalid entry makes no subject', async () => {
        const { alice } = await setup();
        const res = await alice.post('/api/schedules/main/entries').send(cls({ newSubject: 'Ghost', days: [] }));
        expect(res.status).toBe(400);
        expect(await subjectModel.countDocuments()).toBe(0);
    });

    test('events and activities never carry a subject', async () => {
        const { alice, base } = await setup();
        const web = await makeSubject(alice, 'Web Systems');
        const res = await alice.post(`${base}/entries`).send(cls({ kind: 'event', title: 'Party', subject: web._id, newSubject: 'Nope' }));
        expect(res.status).toBe(201);
        expect((await storedEntries(res.body.schedule._id))[0].subject).toBeNull();
        expect(await subjectModel.countDocuments()).toBe(1);
    });

    test('a class with no subject sent links by name; an exam keeps its own title', async () => {
        const { alice, base } = await setup();
        const web = await makeSubject(alice, 'Web Systems');
        const named = await alice.post(`${base}/entries`).send(cls({ title: 'web systems' }));
        expect(named.body.schedule.entries[0].subject).toBe(web._id);
        const test1 = await alice.post(`${base}/entries`).send(exam({ title: 'Midterm: Web Systems' }));
        expect(test1.body.schedule.entries[1]).toMatchObject({ title: 'Midterm: Web Systems', subject: web._id });
    });

    test('editing without a subject keeps the link; null unlinks an exam', async () => {
        const { alice, base } = await setup();
        const web = await makeSubject(alice, 'Web Systems');
        const added = await alice.post(`${base}/entries`).send(exam({ title: 'Quiz', subject: web._id }));
        const entryId = added.body.schedule.entries[0]._id;
        const kept = await alice.put(`${base}/entries/${entryId}`).send(exam({ title: 'Quiz 2' }));
        expect(String((await storedEntries(base.split('/').pop()))[0].subject)).toBe(web._id);
        expect(kept.body.schedule.entries[0].subject).toBe(web._id);
        const cleared = await alice.put(`${base}/entries/${entryId}`).send(exam({ title: 'Quiz 2', subject: null }));
        expect(cleared.body.schedule.entries[0].subject).toBeNull();
    });

    test('changing a class into an event drops the link', async () => {
        const { alice, base } = await setup();
        const web = await makeSubject(alice, 'Web Systems');
        const added = await alice.post(`${base}/entries`).send(cls({ subject: web._id }));
        const res = await alice.put(`${base}/entries/${added.body.schedule.entries[0]._id}`).send(cls({ kind: 'event', title: 'Meetup' }));
        expect((await storedEntries(res.body.schedule._id))[0].subject).toBeNull();
    });
});

describe('editors and viewers cannot set subjects', () => {
    test("an editor's subject and newSubject are ignored", async () => {
        const { alice, bob, base } = await setup();
        const web = await makeSubject(alice, 'Web Systems');
        const mine = await makeSubject(bob, 'Bob Subject');
        const added = await alice.post(`${base}/entries`).send(cls({ subject: web._id }));
        const entryId = added.body.schedule.entries[0]._id;

        const res = await bob.put(`${base}/entries/${entryId}`).send(cls({ title: 'Web Systems', subject: mine._id, newSubject: 'Bob Invented' }));
        expect(res.status).toBe(200);
        expect(String((await storedEntries(res.body.schedule._id))[0].subject)).toBe(web._id);
        expect((await subjectModel.find({ owner: await idOf('bob@student.fatima.edu.ph') })).map((s) => s.name)).toEqual(['Bob Subject']);

        const post = await bob.post(`${base}/entries`).send(cls({ title: 'Brand New', newSubject: 'Bob Invented 2' }));
        expect(post.status).toBe(201);
        expect(post.body.subject).toBeUndefined();
        expect(await subjectModel.countDocuments({ name: /Bob Invented/ })).toBe(0);
    });

    test("a class an editor adds links to the owner's subject of that name", async () => {
        const { alice, bob, base } = await setup();
        const web = await makeSubject(alice, 'Web Systems');
        const res = await bob.post(`${base}/entries`).send(cls({ title: 'Web Systems' }));
        expect(res.status).toBe(201);
        expect(String((await storedEntries(res.body.schedule._id))[0].subject)).toBe(web._id);
    });

    test('a viewer cannot write at all', async () => {
        const { cara, base } = await setup();
        expect((await cara.post(`${base}/entries`).send(cls({ title: 'X', newSubject: 'Y' }))).status).toBe(403);
        expect(await subjectModel.countDocuments()).toBe(0);
    });
});

describe("the owner's subject ids never reach a member", () => {
    const setupWithSubjects = async () => {
        const ctx = await setup();
        const web = await makeSubject(ctx.alice, 'Web Systems');
        const capstone = await makeSubject(ctx.alice, 'Capstone');
        await ctx.alice.post(`${ctx.base}/entries`).send(cls({ subject: web._id }));
        await ctx.alice.post(`${ctx.base}/entries`).send(cls({ subject: capstone._id, days: [2] }));
        await ctx.alice.post(`${ctx.base}/entries`).send(exam({ title: 'Midterm: Web Systems', subject: web._id }));
        return { ...ctx, web, capstone };
    };

    test('GET one timetable: null unless the member has a subject of that name', async () => {
        const { bob, cara, alice, web, capstone, base } = await setupWithSubjects();
        const bobWeb = await makeSubject(bob, 'Web Systems');

        const seen = (await bob.get(base)).body.schedule.entries;
        expect(JSON.stringify(seen)).not.toContain(web._id);
        expect(JSON.stringify(seen)).not.toContain(capstone._id);
        expect(seen.map((e) => e.subject)).toEqual([bobWeb._id, null, bobWeb._id]);

        const caraSeen = (await cara.get(base)).body.schedule.entries;
        expect(caraSeen.every((e) => e.subject === null)).toBe(true);

        const own = (await alice.get(base)).body.schedule.entries;
        expect(own.map((e) => e.subject)).toEqual([web._id, capstone._id, web._id]);
    });

    test('GET week and exams: the same rule', async () => {
        const { alice, bob, web, capstone, base } = await setupWithSubjects();
        const bobWeb = await makeSubject(bob, 'Web Systems');
        const scheduleId = base.split('/').pop();
        await scheduleModel.updateOne({ _id: scheduleId, 'collaborators.user': await idOf('bob@student.fatima.edu.ph') }, { $set: { 'collaborators.$.countInWorkload': true } });

        const res = await bob.get(`/api/schedules/week?start=${monday}`);
        const text = JSON.stringify(res.body);
        expect(text).not.toContain(web._id);
        expect(text).not.toContain(capstone._id);
        const classes = res.body.days.flatMap((d) => d.entries).filter((e) => e.kind === 'class');
        expect(classes.length).toBeGreaterThan(0);
        expect(classes.filter((e) => e.title === 'Web Systems').every((e) => e.subject === bobWeb._id)).toBe(true);
        expect(classes.filter((e) => e.title === 'Capstone').every((e) => e.subject === null)).toBe(true);
        expect(res.body.upcomingExams[0].subject).toBe(bobWeb._id);

        const mine = await alice.get(`/api/schedules/week?start=${monday}`);
        expect(mine.body.days.flatMap((d) => d.entries).find((e) => e.title === 'Capstone').subject).toBe(capstone._id);
    });

    test('preview of a timetable the caller is a member of carries no owner ids', async () => {
        const { bob, web, capstone, base } = await setupWithSubjects();
        const res = await bob.post('/api/schedules/preview').send({ scheduleId: base.split('/').pop() });
        expect(res.status).toBe(200);
        const text = JSON.stringify(res.body);
        expect(text).not.toContain(web._id);
        expect(text).not.toContain(capstone._id);
        expect(res.body.entries.every((e) => e.subject === null)).toBe(true);
    });

    test("preview shows the caller's own entries with their own subject", async () => {
        const { bob, base } = await setupWithSubjects();
        const bobSubject = await makeSubject(bob, 'Networks');
        await bob.post('/api/schedules/main/entries').send(cls({ subject: bobSubject._id, days: [5] }));
        const res = await bob.post('/api/schedules/preview').send({ scheduleId: base.split('/').pop() });
        expect(res.body.existing.map((x) => x.entry.subject)).toEqual([bobSubject._id]);
    });

    test("a copy by a member has no foreign ids and links by name to the member's subjects", async () => {
        const { bob, web, capstone, base } = await setupWithSubjects();
        const bobWeb = await makeSubject(bob, 'Web Systems');
        const res = await bob.post(`${base}/duplicate`).send({});
        expect(res.status).toBe(201);
        const stored = await storedEntries(res.body.schedule._id);
        expect(stored.map((e) => (e.subject ? String(e.subject) : null))).toEqual([bobWeb._id, null, bobWeb._id]);
        expect(JSON.stringify(res.body)).not.toContain(web._id);
        expect(JSON.stringify(res.body)).not.toContain(capstone._id);
    });

    test("an owner's copy keeps the links", async () => {
        const { alice, web, base } = await setupWithSubjects();
        const res = await alice.post(`${base}/duplicate`).send({});
        expect(res.body.schedule.entries[0].subject).toBe(web._id);
    });

    test("importing someone else's classes links them to the importer's subjects by name", async () => {
        const { alice, bob, base } = await setupWithSubjects();
        const bobWeb = await makeSubject(bob, 'Web Systems');
        const code = (await alice.put(`${base}/share-code`).send({ enabled: true, role: 'viewer' })).body.schedule.shareCode;
        const dan = await signUp('dan@student.fatima.edu.ph', 'Dan');
        const danWeb = await makeSubject(dan, 'Web Systems');
        const preview = await dan.post('/api/schedules/preview').send({ shareCode: code });
        const selections = preview.body.entries.map((e) => ({ id: e._id }));
        const res = await dan.post('/api/schedules/import').send({ shareCode: code, selections });
        expect(res.status).toBe(201);
        expect(res.body.schedule.entries.map((e) => e.subject)).toEqual([danWeb._id, null, danWeb._id]);
        expect(JSON.stringify(res.body)).not.toContain(bobWeb._id);
    });

    test('the group chat snapshot drops the subject', async () => {
        const { alice, bob, base } = await setupWithSubjects();
        const group = (await alice.post('/api/groups').send({ name: 'Squad' })).body.group;
        await bob.post('/api/groups/join').send({ joinCode: group.joinCode });
        const res = await alice.post(`/api/groups/${group._id}/messages`).send({ scheduleId: base.split('/').pop() });
        expect(res.status).toBe(200);
        res.body.message.schedule.entries.forEach((e) => expect(e.subject ?? null).toBeNull());
        const seen = await bob.get(`/api/groups/${group._id}/messages`);
        seen.body.messages[0].schedule.entries.forEach((e) => expect(e.subject ?? null).toBeNull());
    });
});

describe('legacy and unusual links', () => {
    test('an entry with no link resolves by name for its owner', async () => {
        const { alice, schedule } = await setup();
        const web = await makeSubject(alice, 'Web Systems');
        await scheduleModel.updateOne({ _id: schedule._id }, { $push: { entries: { title: 'Web Systems', kind: 'class', days: [1], startTime: '08:00', endTime: '09:00' } } });
        await scheduleModel.collection.updateMany({}, { $unset: { 'entries.$[].subject': '' } });
        const res = await alice.get(`/api/schedules/${schedule._id}`);
        expect(res.body.schedule.entries[0].subject).toBe(web._id);
    });

    test('a stored link to an archived subject is not shown', async () => {
        const { alice, schedule, base } = await setup();
        const web = await makeSubject(alice, 'Web Systems');
        await alice.post(`${base}/entries`).send(cls({ subject: web._id }));
        await subjectModel.updateOne({ _id: web._id }, { archivedAt: new Date() });
        const res = await alice.get(`/api/schedules/${schedule._id}`);
        expect(res.body.schedule.entries[0].subject).toBeNull();
    });

    test('the suggestions list skips entries that already have a subject', async () => {
        const { alice, base } = await setup();
        const web = await makeSubject(alice, 'Web Systems');
        await alice.post(`${base}/entries`).send(cls({ subject: web._id }));
        await subjectModel.deleteOne({ _id: web._id });
        // Link is dangling but set: it is not offered again as a suggestion.
        const stale = await alice.get('/api/subjects/suggestions');
        expect(stale.body.suggestions).toEqual([]);
    });
});

describe('the server matcher agrees with the client one', () => {
    const subjects = [
        { _id: 'a', name: 'Web Systems', code: 'IT 301' },
        { _id: 'b', name: 'Discrete Math', code: 'MATH 2' },
        { _id: 'c', name: 'Math', code: '' },
    ];
    const entries = [
        { kind: 'class', title: 'web systems' },
        { kind: 'class', title: 'IT-301' },
        { kind: 'class', title: 'Mathematics' },
        { kind: 'exam', title: 'Midterm: Web Systems' },
        { kind: 'exam', title: 'Quiz for IT 301' },
        { kind: 'exam', title: 'Discrete Math finals' },
        { kind: 'exam', title: 'Math quiz' },
        { kind: 'exam', title: 'Mathematics' },
        { kind: 'event', title: 'Web Systems' },
        { kind: 'activity', title: 'Math' },
        { kind: 'class', title: '' },
    ];

    test.each(entries.map((e) => [`${e.kind}: "${e.title}"`, e]))('%s', (_label, entry) => {
        const server = entrySubjectFor(entry, subjects)?._id ?? null;
        const client = clientEntrySubject(entry, subjects)?._id ?? null;
        expect(server).toBe(client);
    });

    test('the longest whole-word match wins', () => {
        expect(subjectInTitle('Discrete Math finals', subjects)._id).toBe('b');
    });
});
