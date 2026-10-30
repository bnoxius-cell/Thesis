import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import userModel from '../models/userModel.js';
import taskModel from '../models/taskModel.js';
import reviewerModel from '../models/reviewerModel.js';
import scheduleModel from '../models/scheduleModel.js';
import { courseKey } from '../utils/subjectMatch.js';
import { courseKey as clientCourseKey, subjectForLabel } from '../../client/src/utils/subjectColors.js';
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

const addTask = (agent, extra = {}) => agent.post('/api/tasks').send({ title: 'Task', dueDate: '2026-11-20', hours: 2, ...extra });
const addSubject = (agent, body) => agent.post('/api/subjects').send(body);
const reviewerFor = (owner, extra = {}) => reviewerModel.create({ owner, title: 'Notes', ...extra });
const NOT_MINE = 'Pick one of your subjects.';

describe('courseKey', () => {
    test('ignores case, spaces and punctuation, and the client copy agrees', () => {
        const samples = ['IT 301', 'IT-301', 'it301 ', '', '   ', '---', 'Data Structures', 'Álgebra 1'];
        expect(courseKey('IT 301')).toBe('it301');
        expect(courseKey('IT-301')).toBe('it301');
        expect(courseKey('it301 ')).toBe('it301');
        expect(courseKey('---')).toBe('');
        expect(courseKey(null)).toBe('');
        samples.forEach((s) => expect(clientCourseKey(s)).toBe(courseKey(s)));
    });

    test('subjectForLabel matches on name or code and never on an empty key', () => {
        const subjects = [{ _id: 'a', name: 'Data Structures', code: 'IT 301' }];
        expect(subjectForLabel('it301', subjects)?._id).toBe('a');
        expect(subjectForLabel('data-structures', subjects)?._id).toBe('a');
        expect(subjectForLabel('', subjects)).toBeNull();
        expect(subjectForLabel('Other', subjects)).toBeNull();
    });
});

describe('subject CRUD', () => {
    test('needs a signed-in student', async () => {
        const res = await request(app).get('/api/subjects');
        expect(res.body.success).toBe(false);
    });

    test('creates, lists with counts, reads, edits and deletes', async () => {
        const { alice } = await twoStudents();
        const created = await addSubject(alice.agent, { name: ' Data Structures ', code: 'IT 301', term: '1st sem' });
        expect(created.status).toBe(201);
        expect(created.body.subject).toMatchObject({ name: 'Data Structures', code: 'IT 301', term: '1st sem', color: 'blue' });
        const id = created.body.subject._id;

        const task = await addTask(alice.agent, { course: 'IT 301' });
        await reviewerFor(alice.id, { course: 'IT 301', subject: id });
        await addTask(alice.agent, { course: 'IT 301', subject: id });
        await taskModel.updateOne({ _id: task.body.task._id }, { isCompleted: true });

        const list = await alice.agent.get('/api/subjects');
        expect(list.body.subjects).toHaveLength(1);
        expect(list.body.subjects[0].counts).toEqual({ openTasks: 1, reviewers: 1 });

        const one = await alice.agent.get(`/api/subjects/${id}`);
        expect(one.body.subject.name).toBe('Data Structures');

        const edited = await alice.agent.patch(`/api/subjects/${id}`).send({ term: '2nd sem', color: 'teal' });
        expect(edited.body.subject).toMatchObject({ term: '2nd sem', color: 'teal' });

        expect((await alice.agent.delete(`/api/subjects/${id}`)).body.success).toBe(true);
        expect((await alice.agent.get(`/api/subjects/${id}`)).status).toBe(404);
    });

    test('picks a new colour for each subject until all eight are used', async () => {
        const { alice } = await twoStudents();
        const colors = [];
        for (let i = 0; i < 9; i += 1) colors.push((await addSubject(alice.agent, { name: `Subject ${i}` })).body.subject.color);
        expect(new Set(colors.slice(0, 8)).size).toBe(8);
        expect(colors[8]).toBe(colors[0]);
    });

    test('checks the fields', async () => {
        const { alice } = await twoStudents();
        expect((await addSubject(alice.agent, { name: '  ' })).status).toBe(400);
        expect((await addSubject(alice.agent, { name: 'x'.repeat(81) })).status).toBe(400);
        expect((await addSubject(alice.agent, { name: 'Ok', code: 'x'.repeat(21) })).status).toBe(400);
        expect((await addSubject(alice.agent, { name: 'Ok', color: 'red' })).status).toBe(400);
    });

    test('a duplicate name is 409, even with different spacing', async () => {
        const { alice, bob } = await twoStudents();
        await addSubject(alice.agent, { name: 'IT 301' });
        const dup = await addSubject(alice.agent, { name: 'it-301' });
        expect(dup.status).toBe(409);
        expect(dup.body.message).toBe('You already have a subject called it-301.');
        expect((await addSubject(bob.agent, { name: 'IT 301' })).status).toBe(201);

        const other = (await addSubject(alice.agent, { name: 'Math' })).body.subject;
        expect((await alice.agent.patch(`/api/subjects/${other._id}`).send({ name: 'IT301' })).status).toBe(409);
    });

    test('the 31st active subject is refused', async () => {
        const { alice } = await twoStudents();
        for (let i = 0; i < 30; i += 1) expect((await addSubject(alice.agent, { name: `Subject ${i}` })).status).toBe(201);
        const over = await addSubject(alice.agent, { name: 'One too many' });
        expect(over.status).toBe(400);
        expect(over.body.message).toMatch(/up to 30/);
    });

    test('a name of symbols only is allowed and links nothing', async () => {
        const { alice } = await twoStudents();
        await addTask(alice.agent, { course: '---' });
        const made = await addSubject(alice.agent, { name: '???' });
        expect(made.status).toBe(201);
        expect(made.body.linked).toEqual({ tasks: 0, reviewers: 0 });
        expect((await addSubject(alice.agent, { name: '!!!' })).status).toBe(201);
    });
});

describe('ownership', () => {
    test("another student gets 404 on someone's subject, and a bad id is 404", async () => {
        const { alice, bob } = await twoStudents();
        const id = (await addSubject(alice.agent, { name: 'IT 301' })).body.subject._id;

        expect((await bob.agent.get(`/api/subjects/${id}`)).status).toBe(404);
        expect((await bob.agent.patch(`/api/subjects/${id}`).send({ name: 'Mine now' })).status).toBe(404);
        expect((await bob.agent.delete(`/api/subjects/${id}`)).status).toBe(404);
        expect((await bob.agent.put('/api/subjects/order').send({ ids: [id] })).status).toBe(400);
        expect((await alice.agent.get(`/api/subjects/${id}`)).body.subject.name).toBe('IT 301');

        expect((await alice.agent.get('/api/subjects/not-an-id')).status).toBe(404);
        expect((await alice.agent.patch('/api/subjects/not-an-id').send({ name: 'x' })).status).toBe(404);
        expect((await alice.agent.delete('/api/subjects/not-an-id')).status).toBe(404);
        expect((await alice.agent.get(`/api/subjects/${new mongoose.Types.ObjectId()}`)).status).toBe(404);
        expect((await bob.agent.get('/api/subjects')).body.subjects).toEqual([]);
    });

    test("a task or reviewer can't be put on someone else's subject", async () => {
        const { alice, bob } = await twoStudents();
        const bobSubject = (await addSubject(bob.agent, { name: 'Bob only' })).body.subject._id;

        const create = await addTask(alice.agent, { subject: bobSubject });
        expect(create.status).toBe(400);
        expect(create.body.message).toBe(NOT_MINE);

        const mine = await addTask(alice.agent);
        const update = await alice.agent.put(`/api/tasks/${mine.body.task._id}`).send({ subject: bobSubject });
        expect(update.status).toBe(400);
        expect((await alice.agent.put(`/api/tasks/${mine.body.task._id}`).send({ subject: 'nope' })).status).toBe(400);

        const reviewer = await reviewerFor(alice.id);
        const patch = await alice.agent.patch(`/api/reviewers/${reviewer._id}`).send({ subject: bobSubject });
        expect(patch.status).toBe(400);
        expect(patch.body.message).toBe(NOT_MINE);
    });

    test('order only accepts exactly your own active subjects', async () => {
        const { alice } = await twoStudents();
        const a = (await addSubject(alice.agent, { name: 'A' })).body.subject._id;
        const b = (await addSubject(alice.agent, { name: 'B' })).body.subject._id;
        const c = (await addSubject(alice.agent, { name: 'C' })).body.subject._id;

        expect((await alice.agent.put('/api/subjects/order').send({ ids: [a, b] })).status).toBe(400);
        expect((await alice.agent.put('/api/subjects/order').send({ ids: [a, a, b] })).status).toBe(400);
        expect((await alice.agent.put('/api/subjects/order').send({ ids: 'abc' })).status).toBe(400);
        expect((await alice.agent.put('/api/subjects/order').send({ ids: [c, a, b] })).body.success).toBe(true);

        const names = (await alice.agent.get('/api/subjects')).body.subjects.map((s) => s.name);
        expect(names).toEqual(['C', 'A', 'B']);
    });
});

describe('linking tasks and reviewers', () => {
    test("creating a subject links the student's own matching tasks and reviewers, not another student's", async () => {
        const { alice, bob } = await twoStudents();
        const t1 = await addTask(alice.agent, { course: 'it301' });
        const t2 = await addTask(alice.agent, { course: 'IT-301' });
        const t3 = await addTask(alice.agent, { course: 'IT 301 ' });
        const other = await addTask(alice.agent, { course: 'Math 1' });
        const bobTask = await addTask(bob.agent, { course: 'IT 301' });
        await reviewerFor(alice.id, { course: 'It 301' });

        const created = await addSubject(alice.agent, { name: 'Data Structures', code: 'IT 301' });
        expect(created.body.linked).toEqual({ tasks: 3, reviewers: 1 });

        const id = created.body.subject._id;
        const tasks = (await alice.agent.get('/api/tasks')).body.tasks;
        const subjectOf = (res) => tasks.find((t) => t._id === res.body.task._id).subject;
        expect([t1, t2, t3].map(subjectOf)).toEqual([id, id, id]);
        expect(subjectOf(other) ?? null).toBeNull();
        expect((await taskModel.findById(bobTask.body.task._id)).subject).toBeNull();
    });

    test('a linked task shows the subject label, whether picked by id or matched from the course text', async () => {
        const { alice } = await twoStudents();
        const id = (await addSubject(alice.agent, { name: 'Data Structures', code: 'IT 301' })).body.subject._id;

        const byId = await addTask(alice.agent, { subject: id, course: 'whatever' });
        expect(byId.body.task).toMatchObject({ subject: id, course: 'IT 301' });

        const byText = await addTask(alice.agent, { course: 'data structures' });
        expect(byText.body.task).toMatchObject({ subject: id, course: 'IT 301' });

        const unlinked = await addTask(alice.agent, { course: 'Physics' });
        expect(unlinked.body.task.subject ?? null).toBeNull();
    });

    test('a task can be moved to another subject or cleared', async () => {
        const { alice } = await twoStudents();
        const a = (await addSubject(alice.agent, { name: 'A' })).body.subject._id;
        const b = (await addSubject(alice.agent, { name: 'B', code: 'B1' })).body.subject._id;
        const taskId = (await addTask(alice.agent, { subject: a })).body.task._id;

        const moved = await alice.agent.put(`/api/tasks/${taskId}`).send({ subject: b });
        expect(moved.body.task).toMatchObject({ subject: b, course: 'B1' });

        const cleared = await alice.agent.put(`/api/tasks/${taskId}`).send({ subject: null });
        expect(cleared.body.task.subject).toBeNull();
        expect(cleared.body.task.course).toBe('B1');

        const edited = await alice.agent.put(`/api/tasks/${taskId}`).send({ title: 'New title' });
        expect(edited.body.task.subject).toBeNull();
    });

    test('a reviewer takes a subject by id or by course text', async () => {
        const { alice } = await twoStudents();
        const id = (await addSubject(alice.agent, { name: 'Biology', code: 'BIO 1' })).body.subject._id;
        const reviewer = await reviewerFor(alice.id);

        const byId = await alice.agent.patch(`/api/reviewers/${reviewer._id}`).send({ subject: id });
        expect(byId.body.reviewer).toMatchObject({ subject: id, course: 'BIO 1' });

        const cleared = await alice.agent.patch(`/api/reviewers/${reviewer._id}`).send({ subject: null });
        expect(cleared.body.reviewer.subject).toBeNull();

        const byText = await alice.agent.patch(`/api/reviewers/${reviewer._id}`).send({ course: 'bio1' });
        expect(byText.body.reviewer.subject).toBe(id);

        const retitled = await alice.agent.patch(`/api/reviewers/${reviewer._id}`).send({ title: 'Renamed' });
        expect(retitled.body.reviewer.subject).toBe(id);
    });

    test('an imported task links to the importer\'s own subject on a key match', async () => {
        const { alice, bob } = await twoStudents();
        const shared = (await addTask(alice.agent, { course: 'IT 301' })).body.task;
        const id = (await addSubject(bob.agent, { name: 'Data Structures', code: 'IT-301' })).body.subject._id;

        const imported = await bob.agent.post('/api/tasks/import').send({ shareTag: shared.shareTag });
        expect(imported.body.task).toMatchObject({ subject: id, course: 'IT 301' });
    });

    test('renaming relabels linked tasks and re-runs linking for the new key', async () => {
        const { alice } = await twoStudents();
        const created = await addSubject(alice.agent, { name: 'Data Structures', code: 'IT 301' });
        const id = created.body.subject._id;
        const linkedTask = await addTask(alice.agent, { subject: id });
        await addTask(alice.agent, { course: 'IT 302' });

        const renamed = await alice.agent.patch(`/api/subjects/${id}`).send({ code: 'IT 302' });
        expect(renamed.body.linked.tasks).toBe(1);
        const tasks = await taskModel.find({ owner: (await taskModel.findById(linkedTask.body.task._id)).owner });
        expect(tasks.map((t) => t.course)).toEqual(['IT 302', 'IT 302']);
        expect(tasks.every((t) => String(t.subject) === id)).toBe(true);
    });

    test('deleting a subject leaves tasks and reviewers with their label and no link', async () => {
        const { alice } = await twoStudents();
        const id = (await addSubject(alice.agent, { name: 'Data Structures', code: 'IT 301' })).body.subject._id;
        const task = await addTask(alice.agent, { subject: id });
        const reviewer = await reviewerFor(alice.id, { subject: id, course: 'IT 301' });

        await alice.agent.delete(`/api/subjects/${id}`);

        const afterTask = await taskModel.findById(task.body.task._id);
        expect(afterTask.subject).toBeNull();
        expect(afterTask.course).toBe('IT 301');
        const afterReviewer = await reviewerModel.findById(reviewer._id);
        expect(afterReviewer.subject).toBeNull();
        expect(afterReviewer.course).toBe('IT 301');
    });

    test('an archived subject cannot be picked and is left out of the cap', async () => {
        const { alice } = await twoStudents();
        const id = (await addSubject(alice.agent, { name: 'Old term' })).body.subject._id;
        const { default: subjectModel } = await import('../models/subjectModel.js');
        await subjectModel.updateOne({ _id: id }, { archivedAt: new Date() });

        expect((await addTask(alice.agent, { subject: id })).body.message).toBe(NOT_MINE);
        expect((await alice.agent.get('/api/subjects')).body.subjects).toEqual([]);
        expect((await alice.agent.get('/api/subjects?archived=1')).body.subjects).toHaveLength(1);
    });
});

describe('suggestions', () => {
    test('lists distinct labels from tasks, reviewers and classes, minus the ones already subjects', async () => {
        const { alice, bob } = await twoStudents();
        await addTask(alice.agent, { course: 'IT 301' });
        await addTask(alice.agent, { course: 'it-301' });
        await addTask(alice.agent, { course: 'Data Structures' });
        await addTask(alice.agent, { course: '' });
        await addTask(bob.agent, { course: 'Bob only' });
        await reviewerFor(alice.id, { course: 'Biology' });
        await scheduleModel.create({
            title: 'Main',
            owner: alice.id,
            entries: [
                { title: 'IT 301', kind: 'class', startTime: '08:00', endTime: '09:00', days: [1] },
                { title: 'Math 2', kind: 'exam', startTime: '08:00', endTime: '09:00', date: '2026-12-01' },
                { title: 'Gym', kind: 'activity', startTime: '17:00', endTime: '18:00', days: [2] },
            ],
        });
        await addSubject(alice.agent, { name: 'Biology' });

        const { suggestions } = (await alice.agent.get('/api/subjects/suggestions')).body;
        expect(suggestions.map((s) => s.key)).toEqual(['it301', 'datastructures', 'math2']);
        expect(suggestions[0]).toMatchObject({ label: 'IT 301', count: 3, sources: ['tasks', 'schedule'] });
        expect(suggestions.find((s) => s.key === 'math2').sources).toEqual(['schedule']);
    });

    test('shows at most 15', async () => {
        const { alice } = await twoStudents();
        for (let i = 0; i < 17; i += 1) await taskModel.create({ title: 't', owner: alice.id, dueDate: new Date(), course: `Course ${i}` });
        expect((await alice.agent.get('/api/subjects/suggestions')).body.suggestions).toHaveLength(15);
    });
});
