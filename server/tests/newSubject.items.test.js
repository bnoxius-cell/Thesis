import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import userModel from '../models/userModel.js';
import subjectModel, { SUBJECT_LIMITS } from '../models/subjectModel.js';
import taskModel from '../models/taskModel.js';
import flashcardDeckModel, { FLASHCARD_LIMITS } from '../models/flashcardDeckModel.js';
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
    return agent;
};
const makeSubject = async (agent, name, extra = {}) => (await agent.post('/api/subjects').send({ name, ...extra })).body.subject;
const fillSubjects = async (agent, count) => {
    for (let i = 0; i < count; i += 1) await makeSubject(agent, `Filler ${i}`);
};
const subjectsOf = async (agent) => (await agent.get('/api/subjects')).body.subjects;

const task = (extra = {}) => ({ title: 'Problem set 4', dueDate: '2099-03-02', ...extra });
const makeTask = async (agent, extra = {}) => (await agent.post('/api/tasks').send(task(extra))).body.task;

describe('task create with newSubject', () => {
    test('makes the subject, links the task and labels it with the name', async () => {
        const maria = await signUp('maria@student.fatima.edu.ph');
        const res = await maria.post('/api/tasks').send(task({ newSubject: '  Data   Mining ' }));
        expect(res.status).toBe(200);
        const [subject] = await subjectsOf(maria);
        expect(subject.name).toBe('Data Mining');
        expect(res.body.task).toMatchObject({ subject: subject._id, course: 'Data Mining' });
    });

    test('a name that matches a subject in another case reuses it', async () => {
        const maria = await signUp('maria@student.fatima.edu.ph');
        const web = await makeSubject(maria, 'Web Systems', { code: 'IT 301' });
        const res = await maria.post('/api/tasks').send(task({ newSubject: 'web  systems' }));
        expect(res.body.task).toMatchObject({ subject: web._id, course: 'IT 301' });
        expect(await subjectsOf(maria)).toHaveLength(1);
    });

    test('newSubject wins over a subject id sent with it', async () => {
        const maria = await signUp('maria@student.fatima.edu.ph');
        const web = await makeSubject(maria, 'Web Systems');
        const res = await maria.post('/api/tasks').send(task({ subject: web._id, newSubject: 'Networks' }));
        expect(res.body.task.course).toBe('Networks');
        expect(res.body.task.subject).not.toBe(web._id);
    });

    test('a bad task makes no subject', async () => {
        const maria = await signUp('maria@student.fatima.edu.ph');
        const noDate = await maria.post('/api/tasks').send({ title: 'x', newSubject: 'Ghost' });
        expect(noDate.status).toBe(400);
        const unknownCode = await maria.post('/api/tasks').send(task({ newSubject: 'Ghost', shareTag: '123456' }));
        expect(unknownCode.status).toBe(404);
        expect(await subjectModel.countDocuments()).toBe(0);
        expect(await taskModel.countDocuments()).toBe(0);
    });

    test('a blank or too long name is refused and makes nothing', async () => {
        const maria = await signUp('maria@student.fatima.edu.ph');
        const blank = await maria.post('/api/tasks').send(task({ newSubject: '   ' }));
        expect(blank.status).toBe(400);
        expect(blank.body.message).toBe('Give the subject a name.');
        const long = await maria.post('/api/tasks').send(task({ newSubject: 'x'.repeat(SUBJECT_LIMITS.name + 1) }));
        expect(long.status).toBe(400);
        expect(await subjectModel.countDocuments()).toBe(0);
        expect(await taskModel.countDocuments()).toBe(0);
    });

    test('past the subject cap is refused, but an existing name still reuses', async () => {
        const maria = await signUp('maria@student.fatima.edu.ph');
        await fillSubjects(maria, SUBJECT_LIMITS.maxActive);
        const over = await maria.post('/api/tasks').send(task({ newSubject: 'One too many' }));
        expect(over.status).toBe(400);
        expect(over.body.message).toMatch(/up to \d+ subjects/);
        expect(await taskModel.countDocuments()).toBe(0);
        const reuse = await maria.post('/api/tasks').send(task({ newSubject: 'filler 0' }));
        expect(reuse.status).toBe(200);
        expect(await subjectModel.countDocuments()).toBe(SUBJECT_LIMITS.maxActive);
    });

    test("the subject is the caller's own and never touches another student's", async () => {
        const maria = await signUp('maria@student.fatima.edu.ph');
        const jose = await signUp('jose@student.fatima.edu.ph');
        const josesSubject = await makeSubject(jose, 'Physics');
        const mariaId = (await userModel.findOne({ email: 'maria@student.fatima.edu.ph' }))._id.toString();
        const res = await maria.post('/api/tasks').send(task({ newSubject: 'Physics', owner: String(josesSubject._id) }));
        expect(res.status).toBe(200);
        const mine = await subjectsOf(maria);
        expect(mine).toHaveLength(1);
        expect(mine[0]._id).not.toBe(josesSubject._id);
        expect(res.body.task.subject).toBe(mine[0]._id);
        expect((await subjectModel.findById(mine[0]._id)).owner.toString()).toBe(mariaId);
        expect(await subjectsOf(jose)).toHaveLength(1);
    });
});

describe('task update with newSubject', () => {
    test('makes the subject, links the task and relabels it', async () => {
        const maria = await signUp('maria@student.fatima.edu.ph');
        const made = await makeTask(maria, { course: 'Old label' });
        const res = await maria.put(`/api/tasks/${made._id}`).send({ newSubject: 'Data Mining' });
        expect(res.status).toBe(200);
        const [subject] = await subjectsOf(maria);
        expect(subject.name).toBe('Data Mining');
        expect(res.body.task).toMatchObject({ subject: subject._id, course: 'Data Mining' });
    });

    test('a bad update makes no subject and leaves the task alone', async () => {
        const maria = await signUp('maria@student.fatima.edu.ph');
        const made = await makeTask(maria);
        const res = await maria.put(`/api/tasks/${made._id}`).send({ title: '', newSubject: 'Ghost' });
        expect(res.status).toBe(400);
        expect(await subjectModel.countDocuments()).toBe(0);
        expect((await taskModel.findById(made._id)).subject).toBeNull();
    });

    test('an existing name is reused and the cap is enforced', async () => {
        const maria = await signUp('maria@student.fatima.edu.ph');
        const web = await makeSubject(maria, 'Web Systems');
        const made = await makeTask(maria);
        const reuse = await maria.put(`/api/tasks/${made._id}`).send({ newSubject: 'WEB SYSTEMS' });
        expect(reuse.body.task.subject).toBe(web._id);
        await fillSubjects(maria, SUBJECT_LIMITS.maxActive - 1);
        const over = await maria.put(`/api/tasks/${made._id}`).send({ newSubject: 'One too many' });
        expect(over.status).toBe(400);
        expect(await subjectModel.countDocuments()).toBe(SUBJECT_LIMITS.maxActive);
    });

    test("another student's task is not found and makes no subject", async () => {
        const maria = await signUp('maria@student.fatima.edu.ph');
        const jose = await signUp('jose@student.fatima.edu.ph');
        const josesTask = await makeTask(jose);
        const res = await maria.put(`/api/tasks/${josesTask._id}`).send({ newSubject: 'Ghost' });
        expect(res.status).toBe(404);
        expect(await subjectModel.countDocuments()).toBe(0);
        expect((await taskModel.findById(josesTask._id)).subject).toBeNull();
    });
});

describe('deck create and update with newSubject', () => {
    test('create makes the subject and links the deck', async () => {
        const maria = await signUp('maria@student.fatima.edu.ph');
        const res = await maria.post('/api/flashcards/decks').send({ title: 'Trees', newSubject: ' Data  Structures ' });
        expect(res.status).toBe(201);
        const [subject] = await subjectsOf(maria);
        expect(subject.name).toBe('Data Structures');
        expect(res.body.deck).toMatchObject({ subject: subject._id, course: 'Data Structures' });
    });

    test('create reuses a subject with the same name in another case', async () => {
        const maria = await signUp('maria@student.fatima.edu.ph');
        const web = await makeSubject(maria, 'Web Systems');
        const res = await maria.post('/api/flashcards/decks').send({ title: 'HTTP', newSubject: 'web systems' });
        expect(res.body.deck.subject).toBe(web._id);
        expect(await subjectsOf(maria)).toHaveLength(1);
    });

    test('a bad deck makes no subject and no deck', async () => {
        const maria = await signUp('maria@student.fatima.edu.ph');
        const blankTitle = await maria.post('/api/flashcards/decks').send({ title: '  ', newSubject: 'Ghost' });
        expect(blankTitle.status).toBe(400);
        const blankName = await maria.post('/api/flashcards/decks').send({ title: 'Trees', newSubject: ' ' });
        expect(blankName.status).toBe(400);
        expect(await subjectModel.countDocuments()).toBe(0);
        expect(await flashcardDeckModel.countDocuments()).toBe(0);
    });

    test('past the subject cap is refused and makes no deck', async () => {
        const maria = await signUp('maria@student.fatima.edu.ph');
        await fillSubjects(maria, SUBJECT_LIMITS.maxActive);
        const res = await maria.post('/api/flashcards/decks').send({ title: 'Trees', newSubject: 'One too many' });
        expect(res.status).toBe(400);
        expect(await flashcardDeckModel.countDocuments()).toBe(0);
        expect(await subjectModel.countDocuments()).toBe(SUBJECT_LIMITS.maxActive);
    });

    test('a student at the deck limit gets the deck message and no new subject', async () => {
        const maria = await signUp('maria@student.fatima.edu.ph');
        const owner = (await userModel.findOne({ email: 'maria@student.fatima.edu.ph' }))._id;
        await flashcardDeckModel.insertMany(Array.from({ length: FLASHCARD_LIMITS.decks }, (_, i) => ({ owner, title: `Deck ${i}` })));
        const res = await maria.post('/api/flashcards/decks').send({ title: 'Extra', newSubject: 'Ghost' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/decks/);
        expect(await subjectModel.countDocuments()).toBe(0);
    });

    test('update makes the subject, links the deck and relabels it', async () => {
        const maria = await signUp('maria@student.fatima.edu.ph');
        const deck = (await maria.post('/api/flashcards/decks').send({ title: 'Trees' })).body.deck;
        const res = await maria.patch(`/api/flashcards/decks/${deck.id}`).send({ title: 'Layers', newSubject: 'Networks' });
        expect(res.status).toBe(200);
        const [subject] = await subjectsOf(maria);
        expect(res.body.deck).toMatchObject({ title: 'Layers', subject: subject._id, course: 'Networks' });
    });

    test('a bad update makes no subject', async () => {
        const maria = await signUp('maria@student.fatima.edu.ph');
        const deck = (await maria.post('/api/flashcards/decks').send({ title: 'Trees' })).body.deck;
        const res = await maria.patch(`/api/flashcards/decks/${deck.id}`).send({ title: '', newSubject: 'Ghost' });
        expect(res.status).toBe(400);
        expect(await subjectModel.countDocuments()).toBe(0);
    });

    test("another student's deck is not found and makes no subject", async () => {
        const maria = await signUp('maria@student.fatima.edu.ph');
        const jose = await signUp('jose@student.fatima.edu.ph');
        const deck = (await jose.post('/api/flashcards/decks').send({ title: 'Physics' })).body.deck;
        const res = await maria.patch(`/api/flashcards/decks/${deck.id}`).send({ newSubject: 'Ghost' });
        expect(res.status).toBe(404);
        expect(await subjectModel.countDocuments()).toBe(0);
    });
});
