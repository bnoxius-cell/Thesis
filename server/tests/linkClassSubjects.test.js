import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import mongoose from 'mongoose';
import scheduleModel from '../models/scheduleModel.js';
import subjectModel, { SUBJECT_LIMITS } from '../models/subjectModel.js';
import taskModel from '../models/taskModel.js';
import { linkClassSubjects, undoLinkClassSubjects } from '../scripts/linkClassSubjects.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';

beforeAll(connectTestDB);
beforeEach(clearTestDB);
afterAll(closeTestDB);

const newId = () => new mongoose.Types.ObjectId();
const entry = (title, kind = 'class', extra = {}) => ({ title, kind, days: [1], startTime: '08:00', endTime: '09:00', ...extra });

const seed = async () => {
    const owner = newId();
    const web = await subjectModel.create({ owner, name: 'Web Systems', code: 'IT 301' });
    const mine = await scheduleModel.create({
        title: 'Mine',
        owner,
        isMain: true,
        entries: [entry('web-systems'), entry('it301'), entry('Data Mining'), entry('Gym', 'activity'), entry('Quiz in IT 301', 'exam')],
    });
    return { owner, web, mine };
};

const subjectsOf = async (schedule) => (await scheduleModel.findById(schedule._id).lean()).entries.map((e) => (e.subject ? String(e.subject) : null));

describe('linkClassSubjects script', () => {
    test('a dry run reports the links and changes nothing', async () => {
        const { owner, mine } = await seed();
        const before = await scheduleModel.find().lean();

        const { users } = await linkClassSubjects({ createMissing: true });

        expect(users).toHaveLength(1);
        expect(users[0].owner).toBe(String(owner));
        expect(users[0].links.map((l) => l.title)).toEqual(['web-systems', 'it301', 'Quiz in IT 301', 'Data Mining']);
        expect(users[0].created).toEqual([{ subjectId: null, name: 'Data Mining' }]);
        expect(await scheduleModel.find().lean()).toEqual(before);
        expect(await subjectModel.countDocuments()).toBe(1);
        expect(await subjectsOf(mine)).toEqual([null, null, null, null, null]);
    });

    test('apply links classes by name or code and exams by title words, owned timetables only', async () => {
        const { web, mine } = await seed();
        // A timetable shared into someone else's account is not theirs to link: only owners are visited.
        const others = await scheduleModel.create({ title: 'Theirs', owner: newId(), isMain: true, entries: [entry('Web Systems')] });

        const { users } = await linkClassSubjects({ apply: true });

        expect(await subjectsOf(mine)).toEqual([String(web._id), String(web._id), null, null, String(web._id)]);
        expect(await subjectsOf(others)).toEqual([null]);
        expect(users[0].unlinked).toEqual([expect.objectContaining({ title: 'Data Mining', reason: 'no matching subject' })]);
    });

    test('a second run finds nothing to do', async () => {
        await seed();
        await linkClassSubjects({ apply: true, createMissing: true });

        const second = await linkClassSubjects({ apply: true, createMissing: true });

        expect(second.users).toEqual([]);
        expect(await subjectModel.countDocuments()).toBe(2);
    });

    test('create-missing makes one subject per courseKey, named by the most used spelling', async () => {
        const owner = newId();
        await scheduleModel.create({
            title: 'Mine',
            owner,
            isMain: true,
            entries: [entry('data mining'), entry('Data Mining'), entry('Data-Mining'), entry('Data Mining', 'class', { days: [3] }), entry('Networks')],
        });

        await linkClassSubjects({ apply: true, createMissing: true });

        const subjects = await subjectModel.find({ owner }).sort({ order: 1 }).lean();
        expect(subjects.map((s) => s.name)).toEqual(['Data Mining', 'Networks']);
        expect(subjects.map((s) => s.order)).toEqual([0, 1]);
        const schedule = await scheduleModel.findOne({ owner }).lean();
        expect(schedule.entries.map((e) => String(e.subject))).toEqual([
            String(subjects[0]._id), String(subjects[0]._id), String(subjects[0]._id), String(subjects[0]._id), String(subjects[1]._id),
        ]);
    });

    test('create-missing stops at the subject cap and lists what is left', async () => {
        const owner = newId();
        await subjectModel.insertMany(Array.from({ length: SUBJECT_LIMITS.maxActive - 1 }, (_, i) => ({ owner, name: `Subject ${i}`, order: i })));
        await scheduleModel.create({ title: 'Mine', owner, isMain: true, entries: [entry('Alpha'), entry('Beta')] });

        const { users } = await linkClassSubjects({ apply: true, createMissing: true });

        expect(await subjectModel.countDocuments({ owner })).toBe(SUBJECT_LIMITS.maxActive);
        expect(users[0].created.map((s) => s.name)).toEqual(['Alpha']);
        expect(users[0].unlinked).toEqual([expect.objectContaining({ title: 'Beta', reason: expect.stringContaining('limit') })]);
        const stored = (await scheduleModel.findOne({ owner }).lean()).entries.map((e) => e.subject);
        expect(stored[0]).toBeTruthy();
        expect(stored[1]).toBeFalsy();
    });

    test('undo unlinks what apply linked and removes the subjects it created', async () => {
        const { mine, web } = await seed();
        const report = await linkClassSubjects({ apply: true, createMissing: true });

        const result = await undoLinkClassSubjects(report);

        expect(result.deleted.map((s) => s.name)).toEqual(['Data Mining']);
        expect(await subjectsOf(mine)).toEqual([null, null, null, null, null]);
        expect((await subjectModel.find().lean()).map((s) => String(s._id))).toEqual([String(web._id)]);
    });

    test('undo keeps a created subject that has gained a task', async () => {
        const { owner } = await seed();
        const report = await linkClassSubjects({ apply: true, createMissing: true });
        const mining = await subjectModel.findOne({ owner, name: 'Data Mining' });
        await taskModel.create({ owner, title: 'Read chapter 1', subject: mining._id, dueDate: new Date(), course: 'Data Mining' });

        const result = await undoLinkClassSubjects(report);

        expect(result.deleted).toEqual([]);
        expect(result.kept.map((s) => s.name)).toEqual(['Data Mining']);
        expect(await subjectModel.exists({ _id: mining._id })).toBeTruthy();
    });

    test('undo keeps a created subject that has gained notes', async () => {
        const { owner } = await seed();
        const report = await linkClassSubjects({ apply: true, createMissing: true });
        const mining = await subjectModel.findOne({ owner, name: 'Data Mining' });
        await subjectModel.updateOne({ _id: mining._id }, { notes: 'Exam is open notes.' });

        const result = await undoLinkClassSubjects(report);

        expect(result.deleted).toEqual([]);
        expect(result.kept.map((s) => s.name)).toEqual(['Data Mining']);
    });

    test('undo refuses a dry-run report', async () => {
        await seed();
        const report = await linkClassSubjects();

        await expect(undoLinkClassSubjects(report)).rejects.toThrow('dry run');
    });
});
