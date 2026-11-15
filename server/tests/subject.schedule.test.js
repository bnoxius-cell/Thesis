import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app.js';
import userModel from '../models/userModel.js';
import Friend from '../models/Friend.js';
import scheduleModel from '../models/scheduleModel.js';
import subjectModel, { SUBJECT_LIMITS } from '../models/subjectModel.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';
import { removeClassTimes } from '../utils/subjectClassTimes.js';

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

const monday = '2099-03-02';
const signUp = async (email, name) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email, name }));
    return agent;
};
const idOf = async (email) => (await userModel.findOne({ email }))._id.toString();
const makeSubject = async (agent, name) => (await agent.post('/api/subjects').send({ name })).body.subject;
const cls = (title, extra = {}) => ({ title, kind: 'class', days: [1], startTime: '09:00', endTime: '10:00', ...extra });
const stored = (id) => scheduleModel.findById(id).lean();
// A student's first timetable is their main one.
const newTimetable = async (agent, title) => (await agent.post('/api/schedules').send({ title })).body.schedule;

// Alice owns "Study group" (Bob edits) and "Officers" (Bob views), and Bob counts both in his week.
// Bob's subjects "Web Systems" and "Capstone" match the classes in them by name.
const sharedSetup = async () => {
    const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
    const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
    const cara = await signUp('cara@student.fatima.edu.ph', 'Cara');
    const aliceId = await idOf('alice@student.fatima.edu.ph');
    const bobId = await idOf('bob@student.fatima.edu.ph');
    await Friend.create({ user: aliceId, friend: bobId, status: 'accepted' });
    const share = async (title, role, entry) => {
        const schedule = (await alice.post('/api/schedules').send({ title })).body.schedule;
        await alice.post(`/api/schedules/${schedule._id}/entries`).send(entry);
        await alice.post(`/api/schedules/${schedule._id}/share`).send({ userId: bobId, role });
        await bob.put(`/api/schedules/${schedule._id}/membership`).send({ countInWorkload: true });
        return schedule;
    };
    const group = await share('Study group', 'editor', cls('Web Systems', { days: [4], startTime: '10:00', endTime: '11:00' }));
    await share('Officers', 'viewer', cls('Capstone', { days: [5], startTime: '15:00', endTime: '16:00' }));
    const web = await makeSubject(bob, 'Web Systems');
    const capstone = await makeSubject(bob, 'Capstone');
    return { alice, bob, cara, group, web, capstone };
};

describe('GET /api/subjects/:id/schedule', () => {
    test('lists class times from counted shared timetables, canEdit by role', async () => {
        const { bob, web, capstone, group } = await sharedSetup();
        const editable = (await bob.get(`/api/subjects/${web._id}/schedule?start=${monday}`)).body;
        expect(editable.classTimes).toHaveLength(1);
        expect(editable.classTimes[0]).toMatchObject({
            scheduleTitle: 'Study group', scheduleId: group._id, canEdit: true, live: true, days: [4], startTime: '10:00', endTime: '11:00',
        });
        expect(editable.upcoming.map((u) => u.iso)).toEqual(['2099-03-05', '2099-03-12']);

        const viewed = (await bob.get(`/api/subjects/${capstone._id}/schedule?start=${monday}`)).body;
        expect(viewed.classTimes[0]).toMatchObject({ scheduleTitle: 'Officers', canEdit: false, live: false });
    });

    test('leaves out a timetable that is not counted and never carries the owner subject ids', async () => {
        const { alice, bob, web, group } = await sharedSetup();
        const aliceWeb = await makeSubject(alice, 'Web Systems');
        const counted = await bob.get(`/api/subjects/${web._id}/schedule?start=${monday}`);
        expect(JSON.stringify(counted.body)).not.toContain(aliceWeb._id);

        await bob.put(`/api/schedules/${group._id}/membership`).send({ countInWorkload: false });
        const res = await bob.get(`/api/subjects/${web._id}/schedule?start=${monday}`);
        expect(res.body.classTimes).toEqual([]);
    });

    test('is 404 for a subject that is not the caller\'s, with none of the timetable in the answer', async () => {
        const { alice, cara, web } = await sharedSetup();
        expect((await alice.get(`/api/subjects/${web._id}/schedule?start=${monday}`)).status).toBe(404);
        const stranger = await cara.get(`/api/subjects/${web._id}/schedule?start=${monday}`);
        expect(stranger.status).toBe(404);
        expect(JSON.stringify(stranger.body)).not.toContain('Study group');
        expect((await cara.get(`/api/subjects/not-an-id/schedule?start=${monday}`)).status).toBe(404);
    });

    test('needs a sign-in and a real start date', async () => {
        const { bob, web } = await sharedSetup();
        expect((await request(app).get(`/api/subjects/${web._id}/schedule?start=${monday}`)).body.success).toBe(false);
        expect((await bob.get(`/api/subjects/${web._id}/schedule?start=nope`)).status).toBe(400);
    });

    test('a holiday drops that day from upcoming', async () => {
        const { bob, web, group } = await sharedSetup();
        await scheduleModel.updateOne({ _id: group._id }, { $push: { holidayOverrides: { date: '2099-03-05', state: 'holiday', name: 'Day off' } } });
        const res = await bob.get(`/api/subjects/${web._id}/schedule?start=${monday}`);
        expect(res.body.upcoming.map((u) => u.iso)).toEqual(['2099-03-12']);
    });

    test('lists the exams of the subject only', async () => {
        const { bob, web } = await sharedSetup();
        const main = await newTimetable(bob, 'Mine');
        const exam = (title, extra) => ({ title, kind: 'exam', date: '2099-03-10', startTime: '09:00', endTime: '10:00', ...extra });
        await bob.post(`/api/schedules/${main._id}/entries`).send(exam('Midterm', { subject: web._id }));
        await bob.post(`/api/schedules/${main._id}/entries`).send(exam('Other exam'));
        const res = await bob.get(`/api/subjects/${web._id}/schedule?start=${monday}`);
        expect(res.body.exams.map((e) => e.title)).toEqual(['Midterm']);
        expect(res.body.exams[0].subject).toBe(web._id);
    });
});

// Alice owns a main timetable and a live one (Bob edits), each with a Web Systems class, and an exam.
// Bob has his own Web Systems class, which her changes must never touch.
const ownSetup = async () => {
    const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
    const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
    const bobId = await idOf('bob@student.fatima.edu.ph');
    await Friend.create({ user: await idOf('alice@student.fatima.edu.ph'), friend: bobId, status: 'accepted' });
    const web = await makeSubject(alice, 'Web Systems');
    await makeSubject(bob, 'Web Systems');
    const mine = await newTimetable(alice, 'Mine');
    const live = await newTimetable(alice, 'Live');
    await alice.post(`/api/schedules/${live._id}/share`).send({ userId: bobId, role: 'editor' });
    const add = (id, body) => alice.post(`/api/schedules/${id}/entries`).send(body);
    await add(mine._id, cls('Web Systems'));
    await add(mine._id, { title: 'Midterm: Web Systems', kind: 'exam', date: '2099-03-10', startTime: '09:00', endTime: '10:00' });
    await add(live._id, cls('Web Systems', { days: [3] }));
    const bobMain = await newTimetable(bob, 'Mine');
    await bob.post(`/api/schedules/${bobMain._id}/entries`).send(cls('Web Systems'));
    // Bob's timetable that Alice edits, holding a class and an exam that carry Alice's subject id. It is not
    // hers, so nothing she does to the subject may reach it.
    const theirs = await scheduleModel.create({
        title: 'Bob shared',
        owner: bobId,
        collaborators: [{ user: await idOf('alice@student.fatima.edu.ph'), role: 'editor' }],
        entries: [
            { ...cls('Web Systems'), subject: web._id },
            { title: 'Quiz', kind: 'exam', date: '2099-03-10', startTime: '09:00', endTime: '10:00', subject: web._id },
        ],
    });
    return { alice, web, mine, live, bobMain, theirs };
};

// Makes a concurrent edit land on `scheduleId` right after the timetables are read, the way a second
// request would between a load and a write (it also bumps the document version).
const editAfterLoad = (scheduleId) => {
    const find = scheduleModel.find.bind(scheduleModel);
    return vi.spyOn(scheduleModel, 'find').mockImplementation((...args) => {
        const query = find(...args);
        const lean = query.lean.bind(query);
        query.lean = async () => {
            const found = await lean();
            await scheduleModel.updateOne({ _id: scheduleId }, { $inc: { __v: 1 }, $set: { 'entries.0.location': 'Lab 9' } });
            return found;
        };
        return query;
    });
};

describe('subject rename and delete reach class times', () => {
    test('rename relabels owned linked classes only', async () => {
        const { alice, web, mine, live, bobMain } = await ownSetup();
        const res = await alice.patch(`/api/subjects/${web._id}`).send({ name: 'Web Systems 2' });
        expect(res.status).toBe(200);
        expect((await stored(mine._id)).entries.map((e) => e.title)).toEqual(['Web Systems 2', 'Midterm: Web Systems']);
        expect((await stored(live._id)).entries[0].title).toBe('Web Systems 2');
        expect((await stored(live._id)).activity.map((a) => a.summary).slice(1)).toEqual(['renamed "Web Systems" to "Web Systems 2"']);
        expect((await stored(mine._id)).activity).toEqual([]); // not live, so nothing is logged
        expect((await stored(bobMain._id)).entries[0].title).toBe('Web Systems');
    });

    test('rename and delete never touch a timetable the caller does not own', async () => {
        const { alice, web, theirs } = await ownSetup();
        const before = await stored(theirs._id);
        await alice.patch(`/api/subjects/${web._id}`).send({ name: 'Web Systems 2' });
        expect(await stored(theirs._id)).toEqual(before);
        await alice.delete(`/api/subjects/${web._id}?files=keep`);
        expect(await stored(theirs._id)).toEqual(before);
    });

    test('rename and delete still work when a timetable changed after it was read', async () => {
        const { alice, web, mine, live } = await ownSetup();
        const spy = editAfterLoad(live._id);
        try {
            expect((await alice.patch(`/api/subjects/${web._id}`).send({ name: 'Web Systems 2' })).status).toBe(200);
            const renamed = await stored(live._id);
            expect(renamed.entries[0]).toMatchObject({ title: 'Web Systems 2', location: 'Lab 9' });
            expect((await stored(mine._id)).entries[0].title).toBe('Web Systems 2');

            const res = await alice.delete(`/api/subjects/${web._id}?files=keep`);
            expect(res.body).toMatchObject({ success: true, removedClassTimes: 2 });
            expect((await stored(live._id)).entries).toEqual([]);
        } finally {
            spy.mockRestore();
        }
    });

    test('sending the name again finishes a rename that was cut short', async () => {
        const { alice, web, mine } = await ownSetup();
        await subjectModel.updateOne({ _id: web._id }, { name: 'Web Systems 2' });
        expect((await alice.patch(`/api/subjects/${web._id}`).send({ name: 'Web Systems 2' })).status).toBe(200);
        expect((await stored(mine._id)).entries[0].title).toBe('Web Systems 2');
    });

    test('changing only the code leaves class titles alone', async () => {
        const { alice, web, mine } = await ownSetup();
        await alice.patch(`/api/subjects/${web._id}`).send({ code: 'IT 301' });
        expect((await stored(mine._id)).entries[0].title).toBe('Web Systems');
    });

    test('delete removes owned classes, unlinks exams and leaves other timetables alone', async () => {
        const { alice, web, mine, live, bobMain } = await ownSetup();
        const res = await alice.delete(`/api/subjects/${web._id}?files=keep`);
        expect(res.body).toMatchObject({ success: true, removedClassTimes: 2 });
        const own = await stored(mine._id);
        expect(own.entries.map((e) => e.title)).toEqual(['Midterm: Web Systems']);
        expect(own.entries[0].subject).toBeNull();
        const liveDoc = await stored(live._id);
        expect(liveDoc.entries).toEqual([]);
        expect(liveDoc.activity.map((a) => a.summary).slice(1)).toEqual(['removed "Web Systems"']);
        expect((await stored(bobMain._id)).entries).toHaveLength(1);
    });

    test('an edit saved from a copy loaded before a delete fails instead of landing on the wrong entry', async () => {
        const { alice, web, mine } = await ownSetup();
        const aliceId = await idOf('alice@student.fatima.edu.ph');
        const exam = (await stored(mine._id)).entries[1];
        // The subject is deleted (its class pulled, shifting the exam to position 0) while the edit is loaded.
        const findById = scheduleModel.findById.bind(scheduleModel);
        const spy = vi.spyOn(scheduleModel, 'findById').mockImplementationOnce(async (...args) => {
            const doc = await findById(...args);
            await removeClassTimes(aliceId, web._id);
            return doc;
        });
        try {
            const res = await alice.put(`/api/schedules/${mine._id}/entries/${exam._id}`)
                .send({ title: 'Midterm: Web Systems', kind: 'exam', date: '2099-03-10', startTime: '09:00', endTime: '10:00', location: 'Room 5' });
            expect(res.status).toBe(409);
            expect(res.body.message).toBe('This timetable changed. Reload and try again.');
        } finally {
            spy.mockRestore();
        }
        const after = await stored(mine._id);
        expect(after.entries).toHaveLength(1);
        expect(after.entries[0]).toMatchObject({ title: 'Midterm: Web Systems', subject: null });
        expect(after.entries[0].location || '').toBe('');
    });

    test('delete skips a timetable that was deleted after it was read', async () => {
        const { alice, web, live } = await ownSetup();
        const aliceId = await idOf('alice@student.fatima.edu.ph');
        const find = scheduleModel.find.bind(scheduleModel);
        const spy = vi.spyOn(scheduleModel, 'find').mockImplementationOnce((...args) => {
            const query = find(...args);
            const lean = query.lean.bind(query);
            query.lean = async () => {
                const found = await lean();
                await scheduleModel.deleteOne({ _id: live._id });
                return found;
            };
            return query;
        });
        try {
            expect(await removeClassTimes(aliceId, web._id)).toBe(1);
        } finally {
            spy.mockRestore();
        }
    });

    test('a class added before its subject existed is linked when the subject is made', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
        const mine = await newTimetable(alice, 'Mine');
        await alice.post(`/api/schedules/${mine._id}/entries`).send(cls('Data Mining'));
        await alice.post(`/api/schedules/${mine._id}/entries`).send(cls('Networks'));
        const bobMain = await newTimetable(bob, 'Mine');
        await bob.post(`/api/schedules/${bobMain._id}/entries`).send(cls('Data Mining'));
        expect((await stored(mine._id)).entries.every((e) => e.subject === null)).toBe(true);

        const subject = await makeSubject(alice, 'data-mining');
        expect(subject.counts.classTimes).toBe(1);
        const linked = await stored(mine._id);
        expect(String(linked.entries[0].subject)).toBe(subject._id);
        expect(linked.entries[1].subject).toBeNull();
        expect((await stored(bobMain._id)).entries[0].subject).toBeNull();

        await alice.patch(`/api/subjects/${subject._id}`).send({ name: 'Data Mining 2' });
        expect((await stored(mine._id)).entries.map((e) => e.title)).toEqual(['Data Mining 2', 'Networks']);
        const res = await alice.delete(`/api/subjects/${subject._id}?files=keep`);
        expect(res.body).toMatchObject({ success: true, removedClassTimes: 1 });
        expect((await stored(mine._id)).entries.map((e) => e.title)).toEqual(['Networks']);
        expect((await stored(bobMain._id)).entries.map((e) => [e.title, e.subject])).toEqual([['Data Mining', null]]);
    });

    test('making a subject leaves a class that already has one alone', async () => {
        const { alice, web, mine } = await ownSetup();
        await subjectModel.updateOne({ _id: web._id }, { name: 'Old name' });
        const other = await makeSubject(alice, 'Web Systems');
        const entry = (await stored(mine._id)).entries[0];
        expect(String(entry.subject)).toBe(web._id);
        expect(other.counts.classTimes).toBe(0);
    });

    test('renaming a subject links only unlinked classes in the owner timetables that now match', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
        const mine = await newTimetable(alice, 'Mine');
        await alice.post(`/api/schedules/${mine._id}/entries`).send(cls('Data Mining'));
        await alice.post(`/api/schedules/${mine._id}/entries`).send(cls('Networks'));
        const bobMain = await newTimetable(bob, 'Mine');
        await bob.post(`/api/schedules/${bobMain._id}/entries`).send(cls('Data Mining'));
        const subject = await makeSubject(alice, 'Capstone');
        expect(subject.counts.classTimes).toBe(0);

        const res = await alice.patch(`/api/subjects/${subject._id}`).send({ code: 'data-mining' });
        expect(res.status).toBe(200);
        expect(res.body.subject.counts.classTimes).toBe(1);
        const linked = (await stored(mine._id)).entries;
        expect(String(linked[0].subject)).toBe(subject._id);
        expect(linked[1].subject).toBeNull();
        expect((await stored(bobMain._id)).entries[0].subject).toBeNull();
    });

    test('renaming leaves a class that has another subject alone, and a rename to no match links nothing', async () => {
        const { alice, web, mine } = await ownSetup();
        const other = await makeSubject(alice, 'Capstone');
        await alice.patch(`/api/subjects/${other._id}`).send({ name: 'Web Systems 3' });
        expect(String((await stored(mine._id)).entries[0].subject)).toBe(web._id);
        const res = await alice.patch(`/api/subjects/${other._id}`).send({ name: 'Elective' });
        expect(res.body.subject.counts.classTimes).toBe(0);
    });

    test('a failed link after create still answers 201, so a retry is not needed', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const mine = await newTimetable(alice, 'Mine');
        await alice.post(`/api/schedules/${mine._id}/entries`).send(cls('Data Mining'));
        const spy = vi.spyOn(scheduleModel, 'find').mockRejectedValueOnce(new Error('boom'));
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            const res = await alice.post('/api/subjects').send({ name: 'Data Mining' });
            expect(res.status).toBe(201);
            expect(res.body.subject.counts.classTimes).toBe(0);
            expect(log).toHaveBeenCalled();
        } finally {
            spy.mockRestore();
            log.mockRestore();
        }
        expect(await subjectModel.countDocuments({ name: 'Data Mining' })).toBe(1);
        expect((await alice.post('/api/subjects').send({ name: 'Data Mining' })).status).toBe(409);
    });

    test('the created count only includes classes this request linked', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const mine = await newTimetable(alice, 'Mine');
        await alice.post(`/api/schedules/${mine._id}/entries`).send(cls('Data Mining'));
        await alice.post(`/api/schedules/${mine._id}/entries`).send(cls('Data Mining', { days: [2] }));
        const other = new mongoose.Types.ObjectId();
        // Another request links the first class after the list was read and before this update runs.
        const realUpdate = scheduleModel.findOneAndUpdate.bind(scheduleModel);
        const spy = vi.spyOn(scheduleModel, 'findOneAndUpdate').mockImplementationOnce((...args) => {
            const query = realUpdate(...args);
            const run = query.exec.bind(query);
            query.exec = async () => {
                await scheduleModel.updateOne({ _id: mine._id }, { $set: { 'entries.0.subject': other } });
                return run();
            };
            return query;
        });
        try {
            const res = await alice.post('/api/subjects').send({ name: 'Data Mining' });
            expect(res.body.subject.counts.classTimes).toBe(1);
        } finally {
            spy.mockRestore();
        }
        expect(String((await stored(mine._id)).entries[0].subject)).toBe(String(other));
    });

    test('counts show class times in owned timetables', async () => {
        const { alice, web } = await ownSetup();
        expect((await alice.get(`/api/subjects/${web._id}`)).body.subject.counts.classTimes).toBe(2);
        expect((await alice.get('/api/subjects')).body.subjects[0].counts.classTimes).toBe(2);
    });
});

describe('subject notes', () => {
    test('notes that are not text are refused and not saved as empty', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const { _id } = await makeSubject(alice, 'Web Systems');
        await alice.patch(`/api/subjects/${_id}`).send({ notes: 'keep me' });
        for (const notes of [null, 123, ['a'], { a: 1 }]) {
            const res = await alice.patch(`/api/subjects/${_id}`).send({ notes });
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Notes must be text.');
        }
        expect((await subjectModel.findById(_id).lean()).notes).toBe('keep me');
        await alice.patch(`/api/subjects/${_id}`).send({ term: 'x' });
        expect((await subjectModel.findById(_id).lean()).notes).toBe('keep me');
    });

    test('20000 characters are kept, 20001 are refused, lists leave notes out', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const { _id } = await makeSubject(alice, 'Web Systems');
        const body = `line one\nline two${'x'.repeat(SUBJECT_LIMITS.notes - 17)}`;
        const ok = await alice.patch(`/api/subjects/${_id}`).send({ notes: `  ${body}  ` });
        expect(ok.status).toBe(200);
        expect(ok.body.subject.notes).toBe(body);

        const tooLong = await alice.patch(`/api/subjects/${_id}`).send({ notes: 'x'.repeat(SUBJECT_LIMITS.notes + 1) });
        expect(tooLong.status).toBe(400);
        expect(tooLong.body.message).toBe('Notes can be up to 20,000 characters.');

        expect((await alice.get(`/api/subjects/${_id}`)).body.subject.notes).toBe(body);
        expect((await alice.get('/api/subjects')).body.subjects[0].notes).toBeUndefined();
        expect((await subjectModel.findById(_id).lean()).notes).toBe(body);
    });
});
