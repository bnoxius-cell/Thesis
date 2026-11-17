import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import userModel from '../models/userModel.js';
import Friend from '../models/Friend.js';
import taskModel from '../models/taskModel.js';
import reviewerModel from '../models/reviewerModel.js';
import scheduleModel, { MAX_ENTRIES } from '../models/scheduleModel.js';
import subjectModel, { SUBJECT_LIMITS } from '../models/subjectModel.js';
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

const signUp = async (email) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email }));
    return { agent, id: (await userModel.findOne({ email }))._id };
};
const twoStudents = async () => ({
    alice: await signUp('alice@student.fatima.edu.ph'),
    bob: await signUp('bob@student.fatima.edu.ph'),
});

const FIRST_DAY = '2027-01-12';
const addSubject = async (student, name, extra = {}) => (await student.agent.post('/api/subjects').send({ name, ...extra })).body.subject;
const addClass = (student, subject, extra = {}) => student.agent.post('/api/schedules/main/entries').send({
    kind: 'class', title: subject.name, subject: subject._id, days: [1, 3], startTime: '09:00', endTime: '10:30', ...extra,
});
const mainOf = (student) => scheduleModel.findOne({ owner: student.id, isMain: true }).lean();
const entriesOf = async (student) => (await mainOf(student)).entries;
const classesOf = async (student, subject) => (await entriesOf(student)).filter((e) => e.kind === 'class' && String(e.subject) === String(subject._id));
const stored = (subject) => subjectModel.findById(subject._id).lean();

const archive = (student, subject) => student.agent.post(`/api/subjects/${subject._id}/archive`);
const restore = (student, subject) => student.agent.post(`/api/subjects/${subject._id}/restore`);
const newTerm = (student, body) => student.agent.post('/api/subjects/new-term').send(body);
const listed = async (student, query = '') => (await student.agent.get(`/api/subjects${query}`)).body.subjects;

// Fills the owner's main timetable with events until it holds `total` entries.
const fillTimetable = async (student, total) => {
    const have = (await entriesOf(student)).length;
    const filler = Array.from({ length: total - have }, (_, i) => ({
        title: `Event ${i}`, kind: 'event', date: '2027-02-01', startTime: '08:00', endTime: '09:00',
    }));
    await scheduleModel.updateOne({ owner: student.id, isMain: true }, { $push: { entries: { $each: filler } } });
};

// Everything a request must leave alone when it writes nothing.
const snapshot = async (student) => ({
    subjects: await subjectModel.find({ owner: student.id }).sort({ _id: 1 }).lean(),
    schedules: await scheduleModel.find({ owner: student.id }).sort({ _id: 1 }).lean(),
    tasks: await taskModel.find({ owner: student.id }).sort({ _id: 1 }).lean(),
});

// A subject with two class times, an exam, three tasks and a reviewer.
const busySubject = async (student) => {
    const subject = await addSubject(student, 'Web Systems', { code: 'IT 301' });
    await addClass(student, subject);
    await addClass(student, subject, { days: [5], startTime: '13:00', endTime: '14:00', location: 'Room 5', meetingUrl: 'https://meet.example.com/abc' });
    await student.agent.post('/api/schedules/main/entries').send({
        kind: 'exam', title: 'Midterm', subject: subject._id, date: '2027-03-02', startTime: '09:00', endTime: '10:30',
    });
    for (let i = 0; i < 3; i += 1) {
        await student.agent.post('/api/tasks').send({ title: `Task ${i}`, dueDate: '2026-11-20', hours: 2, subject: subject._id });
    }
    await reviewerModel.create({ owner: student.id, title: 'Notes', subject: subject._id });
    return subject;
};

describe('POST /api/subjects/:id/archive', () => {
    test('moves the class times onto the subject, keeps the exam link, tasks and reviewer', async () => {
        const { alice } = await twoStudents();
        const web = await busySubject(alice);
        const tasksBefore = await taskModel.find({ owner: alice.id }).sort({ title: 1 }).lean();

        const res = await archive(alice, web);
        expect(res.status).toBe(200);
        expect(res.body.subject.archivedAt).toBeTruthy();
        expect(res.body.subject.pastClassTimes).toHaveLength(2);
        expect(res.body.subject.pastClassTimes).toContainEqual(expect.objectContaining({
            days: [5], startTime: '13:00', endTime: '14:00', location: 'Room 5', meetingUrl: 'https://meet.example.com/abc',
        }));

        const entries = await entriesOf(alice);
        expect(entries.filter((e) => e.kind === 'class')).toHaveLength(0);
        const [exam] = entries;
        expect(entries).toHaveLength(1);
        expect(String(exam.subject)).toBe(web._id);

        expect(await taskModel.find({ owner: alice.id }).sort({ title: 1 }).lean()).toEqual(tasksBefore);
        expect(await taskModel.countDocuments({ subject: web._id })).toBe(3);
        expect(await reviewerModel.countDocuments({ owner: alice.id, subject: web._id })).toBe(1);
    });

    test('an archived subject leaves the list and shows with ?archived=1', async () => {
        const { alice } = await twoStudents();
        const web = await busySubject(alice);
        await archive(alice, web);
        expect(await listed(alice)).toHaveLength(0);
        const [shown] = await listed(alice, '?archived=1');
        expect(shown).toMatchObject({ _id: web._id, counts: { openTasks: 3, reviewers: 1, classTimes: 0 } });
        expect(shown.pastClassTimes).toHaveLength(2);
    });

    test('an active subject does not send pastClassTimes', async () => {
        const { alice } = await twoStudents();
        const web = await busySubject(alice);
        expect((await listed(alice))[0]).not.toHaveProperty('pastClassTimes');
        expect((await alice.agent.get(`/api/subjects/${web._id}`)).body.subject).not.toHaveProperty('pastClassTimes');
    });

    test('running it again keeps one copy of each time and picks up a class that arrived since', async () => {
        const { alice } = await twoStudents();
        const web = await busySubject(alice);
        const first = await archive(alice, web);
        expect((await archive(alice, web)).body.subject.pastClassTimes).toHaveLength(2);

        await scheduleModel.updateOne({ owner: alice.id, isMain: true }, {
            $push: { entries: { title: 'Web Systems', kind: 'class', subject: web._id, days: [2], startTime: '15:00', endTime: '16:00' } },
        });
        const again = await archive(alice, web);
        expect(again.body.subject.pastClassTimes).toHaveLength(3);
        expect(await classesOf(alice, web)).toHaveLength(0);
        expect(again.body.subject.archivedAt).toBe(first.body.subject.archivedAt);
    });

    test('pulls a customized copy like any other class of the subject', async () => {
        const { alice } = await twoStudents();
        const web = await addSubject(alice, 'Web Systems');
        await addClass(alice, web);
        await scheduleModel.updateOne({ owner: alice.id, isMain: true }, {
            $push: { entries: { title: 'Web Systems', kind: 'class', subject: web._id, days: [4], startTime: '10:00', endTime: '11:00', copyOf: new mongoose.Types.ObjectId() } },
        });
        const res = await archive(alice, web);
        expect(res.body.subject.pastClassTimes).toHaveLength(2);
        expect(await entriesOf(alice)).toHaveLength(0);
    });

    test('more than 20 class times is refused and nothing is written', async () => {
        const { alice } = await twoStudents();
        const web = await addSubject(alice, 'Web Systems');
        await addClass(alice, web);
        const many = Array.from({ length: 25 }, (_, i) => ({
            title: 'Web Systems', kind: 'class', subject: web._id, days: [i % 7], startTime: `0${i % 10}:00`, endTime: `0${i % 10}:30`, date: i < 7 ? '' : `2027-02-${String(i).padStart(2, '0')}`,
        }));
        await scheduleModel.updateOne({ owner: alice.id, isMain: true }, { $push: { entries: { $each: many } } });
        const before = await snapshot(alice);

        const res = await archive(alice, web);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/more than 20 class times/);
        expect(await snapshot(alice)).toEqual(before);
    });

    test("another student's subject and a bad id answer 404 and write nothing", async () => {
        const { alice, bob } = await twoStudents();
        const theirs = await busySubject(bob);
        const before = await snapshot(bob);

        expect((await archive(alice, theirs)).status).toBe(404);
        expect((await alice.agent.post('/api/subjects/nope/archive')).status).toBe(404);
        expect(await snapshot(bob)).toEqual(before);
    });

    test("a timetable shared with the student is never touched", async () => {
        const { alice, bob } = await twoStudents();
        await Friend.create({ user: bob.id, friend: alice.id, status: 'accepted' });
        const bobsWeb = await addSubject(bob, 'Web Systems');
        await bob.agent.post('/api/schedules').send({ title: 'Block A' });
        const shared = (await scheduleModel.findOne({ owner: bob.id, title: 'Block A' }))._id;
        await bob.agent.post(`/api/schedules/${shared}/share`).send({ userId: String(alice.id), role: 'editor' });
        await bob.agent.post(`/api/schedules/${shared}/entries`).send({
            kind: 'class', title: 'Web Systems', subject: bobsWeb._id, days: [1], startTime: '09:00', endTime: '10:00',
        });

        const aliceWeb = await addSubject(alice, 'Web Systems');
        await addClass(alice, aliceWeb);
        const before = await snapshot(bob);
        expect((await archive(alice, aliceWeb)).status).toBe(200);
        expect((await newTerm(alice, { archive: [], subjects: [{ name: 'Networks', classTimes: [{ days: [2], startTime: '08:00', endTime: '09:00' }] }] })).status).toBe(200);

        expect(await snapshot(bob)).toEqual(before);
        expect((await scheduleModel.findById(shared).lean()).entries).toHaveLength(1);
    });
});

describe('POST /api/subjects/:id/restore', () => {
    test('puts the class times back, linked, and the subject back in the list', async () => {
        const { alice } = await twoStudents();
        const web = await busySubject(alice);
        await archive(alice, web);

        const res = await restore(alice, web);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ classTimesAdded: 2, skipped: 0, timetableFull: false });
        expect(res.body.subject.archivedAt).toBeNull();
        expect(res.body.subject).not.toHaveProperty('pastClassTimes');
        expect(res.body.subject.counts.classTimes).toBe(2);

        const classes = await classesOf(alice, web);
        expect(classes).toHaveLength(2);
        expect(classes).toContainEqual(expect.objectContaining({ title: 'Web Systems', days: [5], startTime: '13:00', location: 'Room 5', skipOnHoliday: true }));
        expect((await stored(web)).pastClassTimes).toEqual([]);
        expect(await listed(alice)).toHaveLength(1);
        expect(await listed(alice, '?archived=1')).toHaveLength(0);
    });

    test('class times the timetable already has are skipped', async () => {
        const { alice } = await twoStudents();
        const web = await busySubject(alice);
        await archive(alice, web);
        await scheduleModel.updateOne({ owner: alice.id, isMain: true }, {
            $push: { entries: { title: 'Web Systems', kind: 'class', subject: web._id, days: [3, 1], startTime: '09:00', endTime: '10:30' } },
        });
        const res = await restore(alice, web);
        expect(res.body).toMatchObject({ classTimesAdded: 1, skipped: 1 });
        expect(await classesOf(alice, web)).toHaveLength(2);
    });

    test('an active subject with the same name answers 409 and nothing changes', async () => {
        const { alice } = await twoStudents();
        const web = await busySubject(alice);
        await archive(alice, web);
        await addSubject(alice, 'web-systems');
        const before = await snapshot(alice);

        const res = await restore(alice, web);
        expect(res.status).toBe(409);
        expect(res.body.message).toBe('You already have an active subject called web-systems. Rename one first.');
        expect(await snapshot(alice)).toEqual(before);
    });

    test('30 active subjects answers 400', async () => {
        const { alice } = await twoStudents();
        const old = await addSubject(alice, 'Old');
        await archive(alice, old);
        await subjectModel.insertMany(Array.from({ length: SUBJECT_LIMITS.maxActive }, (_, i) => ({ owner: alice.id, name: `Active ${i}` })));
        const res = await restore(alice, old);
        expect(res.status).toBe(400);
        expect((await stored(old)).archivedAt).toBeTruthy();
    });

    test('a full timetable still restores the subject and says the class times were not added', async () => {
        const { alice } = await twoStudents();
        const web = await busySubject(alice);
        await archive(alice, web);
        await fillTimetable(alice, MAX_ENTRIES);

        const res = await restore(alice, web);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ classTimesAdded: 0, timetableFull: true });
        expect(res.body.subject.archivedAt).toBeNull();
        expect(await entriesOf(alice)).toHaveLength(MAX_ENTRIES);
    });

    test('an active subject, another student and a bad id are refused', async () => {
        const { alice, bob } = await twoStudents();
        const web = await addSubject(alice, 'Web Systems');
        expect((await restore(alice, web)).status).toBe(400);
        await archive(alice, web);
        expect((await restore(bob, web)).status).toBe(404);
        expect((await bob.agent.post('/api/subjects/nope/restore')).status).toBe(404);
        expect((await stored(web)).archivedAt).toBeTruthy();
    });
});

const subjectsFor = (count, firstName = 1) => Array.from({ length: count }, (_, i) => ({
    name: `New ${firstName + i}`,
    code: `N${firstName + i}`,
    // Four subjects with two class times and three with one: 11 in all.
    classTimes: [
        { days: [1, 4], startTime: '08:00', endTime: '09:30', location: 'Lab' },
        ...(i < 4 ? [{ days: [2], startTime: '13:00', endTime: '14:30', meetingUrl: 'https://meet.example.com/x' }] : []),
    ],
}));

describe('POST /api/subjects/new-term', () => {
    const lastTerm = async (student, count) => {
        const old = [];
        for (let i = 0; i < count; i += 1) {
            const subject = await addSubject(student, `Old ${i}`);
            await addClass(student, subject, { days: [i % 7] });
            old.push(subject);
        }
        return old;
    };

    test('archives last term and starts this one: subjects with a term, linked class times from the first day', async () => {
        const { alice } = await twoStudents();
        const old = await lastTerm(alice, 6);

        const res = await newTerm(alice, { archive: old.map((s) => s._id), term: '2nd term 2026-27', firstDay: FIRST_DAY, subjects: subjectsFor(7) });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ archived: 6, classTimesAdded: 11, skipped: 0 });
        expect(res.body.subjects).toHaveLength(7);
        expect(res.body.subjects[0]).toMatchObject({ name: 'New 1', code: 'N1', term: '2nd term 2026-27', counts: { classTimes: 2 } });

        const active = await listed(alice);
        expect(active).toHaveLength(7);
        expect(active.every((s) => s.term === '2nd term 2026-27')).toBe(true);
        expect(await listed(alice, '?archived=1')).toHaveLength(6);

        const entries = await entriesOf(alice);
        const classes = entries.filter((e) => e.kind === 'class');
        expect(classes).toHaveLength(11);
        expect(classes.every((e) => e.startDate === FIRST_DAY && e.subject && !e.copyOf)).toBe(true);
        const bySubject = (name) => classes.filter((e) => String(e.subject) === active.find((s) => s.name === name)._id);
        expect(bySubject('New 1')).toHaveLength(2);
        expect(bySubject('New 5')).toHaveLength(1);
        expect(bySubject('New 1')[0]).toMatchObject({ title: 'New 1', kind: 'class', skipOnHoliday: true });
        expect(entries).toHaveLength(11);
    });

    test('the same request again adds nothing and reports the class times as skipped', async () => {
        const { alice } = await twoStudents();
        const old = await lastTerm(alice, 6);
        const body = { archive: old.map((s) => s._id), term: 'Term 2', firstDay: FIRST_DAY, subjects: subjectsFor(7) };
        await newTerm(alice, body);
        const before = await snapshot(alice);

        const res = await newTerm(alice, body);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ archived: 0, classTimesAdded: 0, skipped: 11 });
        expect(res.body.subjects).toHaveLength(7);
        expect(await snapshot(alice)).toEqual(before);
    });

    test('a retry after the subjects were made but the class times were not finishes the job', async () => {
        const { alice } = await twoStudents();
        const body = { firstDay: FIRST_DAY, subjects: subjectsFor(2) };
        await newTerm(alice, body);
        const main = await mainOf(alice);
        await scheduleModel.updateOne({ _id: main._id }, { $set: { entries: main.entries.slice(0, 1) } });

        const res = await newTerm(alice, body);
        expect(res.body).toMatchObject({ classTimesAdded: 3, skipped: 1 });
        expect(await subjectModel.countDocuments({ owner: alice.id })).toBe(2);
        expect(await entriesOf(alice)).toHaveLength(4);
    });

    test('a subject with the same name that is still active is reused, not made twice', async () => {
        const { alice } = await twoStudents();
        const math = await addSubject(alice, 'Math 101', { term: 'Old term' });
        const res = await newTerm(alice, {
            term: 'Term 2',
            subjects: [{ name: 'math-101', classTimes: [{ days: [1], startTime: '08:00', endTime: '09:00' }] }],
        });
        expect(res.body.subjects).toHaveLength(1);
        expect(res.body.subjects[0]).toMatchObject({ _id: math._id, term: 'Old term' });
        expect(await subjectModel.countDocuments({ owner: alice.id })).toBe(1);
        expect(await classesOf(alice, math)).toHaveLength(1);
    });

    test('a new subject named like an archived one is a new subject', async () => {
        const { alice } = await twoStudents();
        const web = await addSubject(alice, 'Web Systems');
        const res = await newTerm(alice, { archive: [web._id], subjects: [{ name: 'Web Systems', classTimes: [] }] });
        expect(res.status).toBe(200);
        expect(res.body.subjects[0]._id).not.toBe(web._id);
        expect(await listed(alice)).toHaveLength(1);
    });

    test('tasks and reviewers of an archived subject are untouched', async () => {
        const { alice } = await twoStudents();
        const web = await busySubject(alice);
        const tasksBefore = await taskModel.find({ owner: alice.id }).sort({ title: 1 }).lean();
        await newTerm(alice, { archive: [web._id], subjects: [] });
        expect(await taskModel.find({ owner: alice.id }).sort({ title: 1 }).lean()).toEqual(tasksBefore);
        expect(await reviewerModel.countDocuments({ subject: web._id })).toBe(1);
        expect((await entriesOf(alice)).map((e) => e.kind)).toEqual(['exam']);
    });

    describe('a request that is refused writes nothing', () => {
        // Sends `body` with two of the student's subjects to archive, unless `student` already has their own data set up.
        const refused = async (body, status = 400, student) => {
            const alice = student ?? (await twoStudents()).alice;
            const old = student ? [] : await lastTerm(alice, 2);
            const before = await snapshot(alice);
            const res = await newTerm(alice, { archive: old.map((s) => s._id), ...body });
            expect(res.status).toBe(status);
            expect(await snapshot(alice)).toEqual(before);
            return res;
        };
        const oneTime = (extra = {}) => ({ days: [1], startTime: '08:00', endTime: '09:00', ...extra });

        test('one bad class time among good ones', async () => {
            const res = await refused({ subjects: [
                { name: 'Good', classTimes: [oneTime()] },
                { name: 'Bad', classTimes: [oneTime(), oneTime({ startTime: '10:00', endTime: '09:00' })] },
            ] });
            expect(res.body.message).toBe('Bad: The end time must be after the start time.');
        });

        test.each([
            ['a class time with no days', { subjects: [{ name: 'A', classTimes: [oneTime({ days: [] })] }] }],
            ['a first day that is not a date', { firstDay: '2027-02-30', subjects: [{ name: 'A', classTimes: [oneTime()] }] }],
            ['a first day that is not text', { firstDay: 20270112, subjects: [] }],
            ['a nameless subject', { subjects: [{ name: ' ', classTimes: [] }] }],
            ['a term that is too long', { term: 'x'.repeat(SUBJECT_LIMITS.term + 1), subjects: [] }],
            ['more than six class times', { subjects: [{ name: 'A', classTimes: Array.from({ length: 7 }, () => oneTime()) }] }],
            ['more than twelve subjects', { subjects: Array.from({ length: 13 }, (_, i) => ({ name: `S${i}`, classTimes: [] })) }],
            ['the same name twice', { subjects: [{ name: 'Math 1', classTimes: [] }, { name: 'math-1', classTimes: [] }] }],
            ['subjects that are not a list', { subjects: 'Math' }],
            ['an archive list that is not a list', { archive: 'abc', subjects: [] }],
        ])('%s', async (_, body) => {
            await refused(body);
        });

        test("another student's subject id", async () => {
            const { alice, bob } = await twoStudents();
            const theirs = await addSubject(bob, 'Bob Only');
            const old = await lastTerm(alice, 2);
            const [aliceBefore, bobBefore] = [await snapshot(alice), await snapshot(bob)];

            const res = await newTerm(alice, { archive: [...old.map((s) => s._id), theirs._id], subjects: subjectsFor(2) });
            expect(res.status).toBe(404);
            expect(await snapshot(alice)).toEqual(aliceBefore);
            expect(await snapshot(bob)).toEqual(bobBefore);
        });

        test('a bad subject id', async () => {
            await refused({ archive: ['nope'], subjects: subjectsFor(1) }, 404);
        });

        test('the 81st entry', async () => {
            const { alice } = await twoStudents();
            const keep = await addSubject(alice, 'Keep');
            await addClass(alice, keep);
            await fillTimetable(alice, MAX_ENTRIES);
            const res = await refused({ subjects: [{ name: 'Extra', classTimes: [oneTime()] }] }, 400, alice);
            expect(res.body.message).toBe(`A schedule can hold up to ${MAX_ENTRIES} entries.`);
        });

        test('more than 30 active subjects once the archive is done', async () => {
            const { alice } = await twoStudents();
            await subjectModel.insertMany(Array.from({ length: SUBJECT_LIMITS.maxActive - 1 }, (_, i) => ({ owner: alice.id, name: `Active ${i}` })));
            await refused({ subjects: subjectsFor(3) }, 400, alice);
        });
    });

    test('the room the archived classes free up counts toward the 80 entries', async () => {
        const { alice } = await twoStudents();
        const old = await addSubject(alice, 'Old');
        await addClass(alice, old);
        await addClass(alice, old, { days: [5] });
        await fillTimetable(alice, MAX_ENTRIES);

        const res = await newTerm(alice, { archive: [old._id], subjects: [{ name: 'New', classTimes: [
            { days: [1], startTime: '08:00', endTime: '09:00' }, { days: [2], startTime: '08:00', endTime: '09:00' },
        ] }] });
        expect(res.status).toBe(200);
        expect(res.body.classTimesAdded).toBe(2);
        expect(await entriesOf(alice)).toHaveLength(MAX_ENTRIES);
    });

    test('30 active subjects is fine when archiving makes room for the new ones', async () => {
        const { alice } = await twoStudents();
        await subjectModel.insertMany(Array.from({ length: SUBJECT_LIMITS.maxActive }, (_, i) => ({ owner: alice.id, name: `Active ${i}` })));
        const some = await subjectModel.find({ owner: alice.id }).limit(3).lean();
        const res = await newTerm(alice, { archive: some.map((s) => s._id), subjects: subjectsFor(3) });
        expect(res.status).toBe(200);
        expect(await subjectModel.countDocuments({ owner: alice.id, archivedAt: null })).toBe(SUBJECT_LIMITS.maxActive);
    });

    test('a timetable shared with the student is never touched', async () => {
        const { alice, bob } = await twoStudents();
        await Friend.create({ user: bob.id, friend: alice.id, status: 'accepted' });
        await bob.agent.post('/api/schedules').send({ title: 'Block A' });
        const shared = (await scheduleModel.findOne({ owner: bob.id, title: 'Block A' }))._id;
        await bob.agent.post(`/api/schedules/${shared}/share`).send({ userId: String(alice.id), role: 'editor' });
        await bob.agent.post(`/api/schedules/${shared}/entries`).send({ kind: 'class', title: 'Networks', days: [1], startTime: '09:00', endTime: '10:00' });
        const before = await scheduleModel.findById(shared).lean();

        const res = await newTerm(alice, { subjects: [{ name: 'Networks', classTimes: [{ days: [1], startTime: '09:00', endTime: '10:00' }] }] });
        expect(res.body.classTimesAdded).toBe(1);
        expect(await scheduleModel.findById(shared).lean()).toEqual(before);
        expect(await entriesOf(alice)).toHaveLength(1);
    });

    test('a request with nothing to do answers 200 and writes nothing', async () => {
        const { alice } = await twoStudents();
        const res = await newTerm(alice, {});
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ archived: 0, subjects: [], classTimesAdded: 0, skipped: 0 });
        expect(await scheduleModel.countDocuments({ owner: alice.id })).toBe(0);
    });

    test('needs a signed-in student', async () => {
        const res = await request(app).post('/api/subjects/new-term').send({});
        expect(res.body).toEqual({ success: false, message: 'Unauthorized' });
    });
});
