import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import userModel from '../models/userModel.js';
import taskModel from '../models/taskModel.js';
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

// The merged "Add subject" form: POST /api/subjects takes the subject's class times with it.

const signUp = async (email) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email }));
    return { agent, id: (await userModel.findOne({ email }))._id };
};

const time = (extra = {}) => ({ days: [1, 3], startTime: '08:00', endTime: '09:30', location: 'Rm 305', ...extra });
const create = (student, body) => student.agent.post('/api/subjects').send(body);
const entriesOf = async (student) => (await scheduleModel.findOne({ owner: student.id, isMain: true }).lean())?.entries ?? [];
const snapshot = async (student) => ({
    subjects: await subjectModel.countDocuments({ owner: student.id }),
    entries: (await entriesOf(student)).length,
});

describe('POST /api/subjects with class times', () => {
    test('makes the subject and its linked class times on the main timetable, creating it when there is none', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph');
        const res = await create(alice, { name: 'Databases', code: 'DBMS 101', classTimes: [time(), time({ days: [5], startTime: '13:00', endTime: '16:00', location: 'Lab 2' })] });
        expect(res.status).toBe(201);
        expect(res.body.classTimesAdded).toBe(2);
        expect(res.body.subject).toMatchObject({ name: 'Databases', code: 'DBMS 101', counts: { classTimes: 2 } });

        const entries = await entriesOf(alice);
        expect(entries).toHaveLength(2);
        for (const entry of entries) {
            expect(entry).toMatchObject({ kind: 'class', title: 'Databases' });
            expect(String(entry.subject)).toBe(res.body.subject._id);
        }
        expect(entries.map((e) => e.location).sort()).toEqual(['Lab 2', 'Rm 305']);
        const listed = (await alice.agent.get('/api/subjects')).body.subjects;
        expect(listed[0].counts.classTimes).toBe(2);
    });

    test('without class times it behaves as before', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph');
        const res = await create(alice, { name: 'Databases' });
        expect(res.status).toBe(201);
        expect(res.body.classTimesAdded).toBe(0);
        expect(await entriesOf(alice)).toHaveLength(0);
        expect((await create(alice, { name: 'Networks', classTimes: [] })).status).toBe(201);
    });

    test('a class time that repeats another in the request is added once', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph');
        const res = await create(alice, { name: 'Databases', classTimes: [time(), time({ days: [3, 1] })] });
        expect(res.status).toBe(201);
        expect(res.body.classTimesAdded).toBe(1);
        expect(await entriesOf(alice)).toHaveLength(1);
    });

    test('a bad class time refuses everything and writes nothing', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph');
        const cases = [
            ['the end before the start', [time(), time({ startTime: '10:00', endTime: '09:00' })]],
            ['no days', [time({ days: [] })]],
            ['not a list', 'monday'],
            ['more than six', Array.from({ length: 7 }, (_, i) => time({ days: [(i % 6) + 1], startTime: `0${i + 1}:00`, endTime: `0${i + 1}:30` }))],
        ];
        for (const [, classTimes] of cases) {
            const res = await create(alice, { name: 'Databases', classTimes });
            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/Databases/);
        }
        expect(await snapshot(alice)).toEqual({ subjects: 0, entries: 0 });
    });

    test('a full timetable refuses the whole request, subject included', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph');
        await create(alice, { name: 'First', classTimes: [time()] });
        const main = await scheduleModel.findOne({ owner: alice.id, isMain: true });
        const filler = { kind: 'event', title: 'Filler', days: [2], startTime: '06:00', endTime: '06:30' };
        main.entries.push(...Array.from({ length: MAX_ENTRIES - 2 }, () => filler));
        await main.save();
        const before = await snapshot(alice);
        expect(before.entries).toBe(MAX_ENTRIES - 1);

        const res = await create(alice, { name: 'Second', classTimes: [time({ days: [2] }), time({ days: [4] })] });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe(`A schedule can hold up to ${MAX_ENTRIES} entries.`);
        expect(await snapshot(alice)).toEqual(before);

        // One that fits still goes in, so the cap is on the count and not on the request.
        expect((await create(alice, { name: 'Third', classTimes: [time({ days: [4] })] })).status).toBe(201);
        expect(await entriesOf(alice)).toHaveLength(MAX_ENTRIES);
    });

    test('the subject cap and a name already taken write no class times either', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph');
        await create(alice, { name: 'Databases' });
        const taken = await create(alice, { name: 'databases', classTimes: [time()] });
        expect(taken.status).toBe(409);
        expect(await entriesOf(alice)).toHaveLength(0);

        await subjectModel.insertMany(Array.from({ length: SUBJECT_LIMITS.maxActive - 1 }, (_, i) => ({ owner: alice.id, name: `Filler ${i}` })));
        const capped = await create(alice, { name: 'One too many', classTimes: [time()] });
        expect(capped.status).toBe(400);
        expect(await entriesOf(alice)).toHaveLength(0);
    });

    test('class times come out again when the subject cannot be made', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph');
        const failing = vi.spyOn(subjectModel, 'create').mockRejectedValueOnce(new Error('database down'));
        const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
        const res = await create(alice, { name: 'Databases', classTimes: [time(), time({ days: [5] })] });
        failing.mockRestore();
        quiet.mockRestore();
        expect(res.status).toBe(500);
        expect(await snapshot(alice)).toEqual({ subjects: 0, entries: 0 });
    });

    test('the new subject also takes its matching tasks and unlinked classes, next to the class times it brings', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph');
        await taskModel.create({ owner: alice.id, title: 'Quiz', course: 'Databases', dueDate: '2099-03-01', hours: 1 });
        await scheduleModel.create({
            owner: alice.id, title: 'My week', isMain: true,
            entries: [{ kind: 'class', title: 'Databases', days: [2], startTime: '10:00', endTime: '11:00' }],
        });
        const res = await create(alice, { name: 'Databases', classTimes: [time()] });
        expect(res.status).toBe(201);
        expect(res.body.linked.tasks).toBe(1);
        expect(res.body.subject.counts.classTimes).toBe(2);
        expect((await entriesOf(alice)).every((e) => String(e.subject) === res.body.subject._id)).toBe(true);
    });

    test("another student's timetable is never touched", async () => {
        const alice = await signUp('alice@student.fatima.edu.ph');
        const bob = await signUp('bob@student.fatima.edu.ph');
        await create(alice, { name: 'Databases', classTimes: [time()] });
        expect(await entriesOf(bob)).toHaveLength(0);
        expect((await bob.agent.get('/api/subjects')).body.subjects).toEqual([]);
    });
});
