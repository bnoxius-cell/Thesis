import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import reviewerModel from '../models/reviewerModel.js';
import groupMessageModel from '../models/groupMessageModel.js';
import { generateJson, isGeminiConfigured } from '../utils/gemini.js';
import { generationSettings, settleGenerationJobs } from '../controllers/reviewerController.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';
import { makePdf, STUDY_LINES } from './helpers/pdf.js';

vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../utils/gemini.js', () => ({
    generateJson: vi.fn(),
    isGeminiConfigured: vi.fn(() => true),
}));

const PDF = makePdf(STUDY_LINES);
const EXPLANATION = 'Because the notes say so.';

// Answer words that appear nowhere else, so a leak is easy to spot in a payload.
const SECRETS = ['Quokka', 'Marsupial', 'Okapi', 'Wombat', 'Alpha', 'Bravo', 'Charlie', 'Delta'];

const item = (answer, accepted = []) => ({ answer, accepted });
const base = { topic: 'Animals', explanation: EXPLANATION, difficulty: 'medium', options: [], correctIndex: 0, answer: '', accepted: [], items: [], points: [] };
const mc = { ...base, type: 'multiple_choice', prompt: 'Which animal carries young in a pouch?', options: ['Kangaroo', 'Horse', 'Cow', 'Pig'], correctIndex: 0 };
const tf = { ...base, type: 'true_false', prompt: 'Cows lay eggs.', answer: 'False' };
const idQuokka = { ...base, type: 'identification', prompt: 'Which small marsupial is known for smiling?', answer: 'Quokka', accepted: ['Marsupial'] };
const idOkapi = { ...base, type: 'identification', prompt: 'Which relative of the giraffe has striped legs?', answer: 'Okapi' };
const fill = { ...base, type: 'fill_blank', prompt: 'A _____ is a burrowing marsupial with cube-shaped droppings.', answer: 'Wombat' };
const list = { ...base, type: 'enumeration', prompt: 'Give the first 4 Greek letters.', items: [item('Alpha'), item('Bravo'), item('Charlie'), item('Delta')] };

const output = (questions) => ({
    summary: 'About animals.',
    topics: [{ name: 'Animals', summary: 'Who lives where.' }],
    keyPoints: ['Some animals have pouches.'],
    keyTerms: [{ term: 'Marsupial', definition: 'A mammal that carries young in a pouch.' }],
    questions,
});
const MIXED = [mc, tf, idQuokka, idOkapi, fill, list];

beforeAll(async () => {
    generationSettings.retryDelaysMs = [0, 0, 0];
    await connectTestDB();
});
beforeEach(async () => {
    await clearTestDB();
    generateJson.mockReset();
    generateJson.mockResolvedValue({ data: output(MIXED), model: 'gemini-test' });
    isGeminiConfigured.mockReturnValue(true);
});
afterAll(closeTestDB);

const signUp = async (email, name) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email, name }));
    agent.id = (await agent.get('/api/user/data')).body.userData._id;
    return agent;
};

const upload = (agent, fields = {}) => {
    let req = agent.post('/api/reviewers');
    for (const [key, value] of Object.entries({ title: 'Animal notes', ...fields })) req = req.field(key, value);
    return req.attach('pdf', PDF, { filename: 'animals.pdf', contentType: 'application/pdf' });
};

const makeReady = async (agent, fields) => {
    const res = await upload(agent, fields);
    expect(res.status).toBe(201);
    await settleGenerationJobs();
    return res.body.reviewer._id;
};

// Starts a session and answers questions by their text, finding each one by its start.
const startSession = async (agent, reviewerId) => {
    const { session } = (await agent.post(`/api/reviewers/${reviewerId}/sessions`).send({})).body;
    const base = `/api/reviewers/${reviewerId}/sessions/${session._id}`;
    const find = (start) => session.questions.find((q) => q.prompt.startsWith(start));
    const answer = (question, body) => agent.post(`${base}/answer`).send({ questionId: question._id, ...body });
    return { session, base, find, answer };
};

describe('creating a reviewer with a question type', () => {
    test('stores the type and asks Gemini for it', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        generateJson.mockResolvedValue({ data: output([idQuokka, idOkapi, { ...idOkapi, prompt: 'Which animal is a Quokka cousin?', answer: 'Kangaroo' }]), model: 'gemini-test' });
        const res = await upload(alice, { questionType: 'identification', questionCount: '10' });
        expect(res.status).toBe(201);
        expect(res.body.reviewer.questionType).toBe('identification');
        await settleGenerationJobs();

        expect(generateJson.mock.calls[0][0].prompt).toContain('exactly 10 identification questions');
        const got = (await alice.get(`/api/reviewers/${res.body.reviewer._id}`)).body.reviewer;
        expect(got).toMatchObject({ questionType: 'identification', questionCount: 3 });
        expect((await alice.get('/api/reviewers')).body.reviewers[0].questionType).toBe('identification');
    });

    test('no type means multiple choice', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const res = await upload(alice);
        expect(res.body.reviewer.questionType).toBe('multiple_choice');
        await settleGenerationJobs();
        expect(generateJson.mock.calls[0][0].prompt).toContain('multiple-choice questions');
    });

    test('a type that does not exist, or essay for now, is refused before anything is made', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        for (const questionType of ['riddle', 'essay']) {
            const res = await upload(alice, { questionType });
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Pick a question type.');
        }
        expect(await reviewerModel.countDocuments()).toBe(0);
        expect(generateJson).not.toHaveBeenCalled();
    });

    test('a mixed set keeps every kind', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const id = await makeReady(alice, { questionType: 'mixed' });
        const stored = await reviewerModel.findById(id);
        expect(stored.questions.map((q) => q.type).sort()).toEqual(['enum', 'fill', 'id', 'id', 'mc', 'tf']);
    });

    test('kinds the reviewer did not ask for are dropped, and too few left fails the run', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const id = await makeReady(alice, { questionType: 'true_false' });
        expect((await reviewerModel.findById(id)).status).toBe('failed');
    });

    test('regenerate can change the type, and keeps it when none is sent', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const id = await makeReady(alice, { questionType: 'mixed' });
        expect((await alice.post(`/api/reviewers/${id}/regenerate`).send({ questionType: 'riddle' })).status).toBe(400);
        const same = await alice.post(`/api/reviewers/${id}/regenerate`).send({});
        expect(same.body.reviewer.questionType).toBe('mixed');
        await settleGenerationJobs();
        const changed = await alice.post(`/api/reviewers/${id}/regenerate`).send({ questionType: 'fill_blank' });
        expect(changed.body.reviewer.questionType).toBe('fill_blank');
        await settleGenerationJobs();
        expect(generateJson.mock.calls.at(-1)[0].prompt).toContain('fill_blank');
    });
});

describe('answering by type', () => {
    const readyMixed = async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const id = await makeReady(alice, { questionType: 'mixed' });
        return { alice, id, ...(await startSession(alice, id)) };
    };

    test('the session never carries the answer key', async () => {
        const { session } = await readyMixed();
        const json = JSON.stringify(session);
        for (const leak of ['"accepted"', '"items"', '"points"', '"answer"', ...SECRETS]) expect(json, leak).not.toContain(leak);
        expect(session.questions.map((q) => q.type).sort()).toEqual(['enum', 'fill', 'id', 'id', 'mc', 'tf']);
        expect(session.questions.find((q) => q.type === 'enum').count).toBe(4);
        expect(session.questions.find((q) => q.type === 'tf').options).toEqual(['True', 'False']);
    });

    test('a typed answer is graded on the server and the answer comes back after', async () => {
        const { find, answer } = await readyMixed();
        const right = await answer(find('Which small marsupial'), { text: '  the quokka! ' });
        expect(right.body.result).toMatchObject({ type: 'id', correct: true, text: 'the quokka!', answer: 'Quokka', explanation: EXPLANATION });
        const accepted = await answer(find('A _____'), { text: 'Wombat' });
        expect(accepted.body.result).toMatchObject({ type: 'fill', correct: true, answer: 'Wombat' });
        const wrong = await answer(find('Which relative'), { text: 'Giraffe' });
        expect(wrong.body.result).toMatchObject({ correct: false, answer: 'Okapi' });
    });

    test('true or false is graded by choice', async () => {
        const { find, answer } = await readyMixed();
        const question = find('Cows lay eggs');
        expect((await answer(question, { choice: 2 })).body.message).toBe('Pick True or False.');
        const res = await answer(question, { choice: 1 });
        expect(res.body.result).toMatchObject({ type: 'tf', correct: true, correctIndex: 1 });
    });

    test('a partial enumeration shows how many were right but does not count', async () => {
        const { find, answer } = await readyMixed();
        const res = await answer(find('Give the first 4'), { entries: ['alpha', 'Charlie', 'Bravo', 'Omega'] });
        expect(res.body.result).toMatchObject({
            type: 'enum', correct: false, got: 3, of: 4, matched: [0, 2, 1, -1], items: ['Alpha', 'Bravo', 'Charlie', 'Delta'],
        });
        expect(res.body.result.entries).toEqual(['alpha', 'Charlie', 'Bravo', 'Omega']);
    });

    test('a full enumeration is right in any order', async () => {
        const { find, answer } = await readyMixed();
        const res = await answer(find('Give the first 4'), { entries: ['Delta', 'Charlie', 'Bravo', 'Alpha'] });
        expect(res.body.result).toMatchObject({ correct: true, got: 4, of: 4 });
    });

    test('an answer of the wrong shape is a 400 and nothing is stored', async () => {
        const { find, answer, session, alice, id } = await readyMixed();
        const refused = [
            [find('Which small marsupial'), { choice: 0 }, 'Type your answer first.'],
            [find('Which small marsupial'), { text: 42 }, 'Type your answer first.'],
            [find('Which small marsupial'), { text: { $gt: '' } }, 'Type your answer first.'],
            [find('Which small marsupial'), { text: '   ' }, 'Type your answer first.'],
            [find('Which small marsupial'), { text: 'x'.repeat(201) }, 'Type your answer first.'],
            [find('Which animal carries'), { text: 'Kangaroo' }, 'Pick one of the four answers.'],
            [find('Give the first 4'), { entries: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }, 'Type at least one answer first.'],
            [find('Give the first 4'), { entries: ['', '  '] }, 'Type at least one answer first.'],
            [find('Give the first 4'), { entries: 'Alpha' }, 'Type at least one answer first.'],
            [find('Give the first 4'), { entries: [1, 2] }, 'Type at least one answer first.'],
            [find('Give the first 4'), { text: 'Alpha' }, 'Type at least one answer first.'],
        ];
        for (const [question, body, message] of refused) {
            const res = await answer(question, body);
            expect([res.status, res.body.message, body]).toEqual([400, message, body]);
        }
        expect((await alice.get(`/api/reviewers/${id}/sessions/${session._id}`)).body.session.answers).toEqual([]);
    });

    test('the first answer counts, and resuming returns what was typed', async () => {
        const { find, answer, base, alice } = await readyMixed();
        await answer(find('Give the first 4'), { entries: ['Alpha', 'Bravo'] });
        await answer(find('Which small marsupial'), { text: 'Quokka' });
        const again = await answer(find('Which small marsupial'), { text: 'Okapi' });
        expect(again.body.result).toMatchObject({ correct: true, text: 'Quokka' });

        const resumed = (await alice.get(base)).body.session.answers;
        expect(resumed.find((a) => a.type === 'enum')).toMatchObject({ entries: ['Alpha', 'Bravo'], got: 2, of: 4, correct: false });
        expect(resumed.find((a) => a.type === 'id')).toMatchObject({ text: 'Quokka', answer: 'Quokka' });
    });

    test('typed answers count in the score', async () => {
        const { find, answer, base, alice } = await readyMixed();
        await answer(find('Which small marsupial'), { text: 'Quokka' });
        await answer(find('Give the first 4'), { entries: ['Alpha'] });
        const done = await alice.post(`${base}/finish`).send({});
        expect(done.body.session).toMatchObject({ correct: 1, answered: 2 });
        expect(done.body.review.find((r) => r.type === 'enum')).toMatchObject({ got: 1, of: 4, correct: false });
    });

    test('someone else cannot answer on the session', async () => {
        const { base, find, session } = await readyMixed();
        const jose = await signUp('jose@student.fatima.edu.ph', 'Jose');
        const res = await jose.post(`${base}/answer`).send({ questionId: find('Which small marsupial')._id, text: 'Quokka' });
        expect(res.status).toBe(404);
        expect(session.questions.length).toBeGreaterThan(0);
    });
});

describe('questions from before types existed', () => {
    test('an old reviewer still answers by choice', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const questionId = new mongoose.Types.ObjectId();
        const { insertedId } = await reviewerModel.collection.insertOne({
            owner: new mongoose.Types.ObjectId(alice.id),
            title: 'Old reviewer',
            status: 'ready',
            version: 1,
            topics: [{ name: 'Animals', summary: '' }],
            questions: [{ _id: questionId, topic: 'Animals', prompt: 'Old question?', options: ['a', 'b', 'c', 'd'], correctIndex: 2, explanation: 'Old.', difficulty: 'easy' }],
        });
        const { find, answer } = await startSession(alice, String(insertedId));
        const question = find('Old question');
        expect(question).toMatchObject({ type: 'mc', options: ['a', 'b', 'c', 'd'] });
        const res = await answer(question, { choice: 2 });
        expect(res.body.result).toMatchObject({ type: 'mc', choice: 2, correct: true, correctIndex: 2 });
        expect((await alice.get('/api/reviewers')).body.reviewers[0].questionType).toBe('multiple_choice');
    });
});

describe('sharing a reviewer with typed questions', () => {
    test('a saved copy keeps the type, the answers and the items', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
        const group = (await alice.post('/api/groups').send({ name: 'Study Squad' })).body.group;
        await bob.post('/api/groups/join').send({ joinCode: group.joinCode });
        const id = await makeReady(alice, { questionType: 'mixed' });

        const sent = await alice.post(`/api/groups/${group._id}/messages`).send({ reviewerId: id });
        expect(sent.status).toBe(200);
        expect(sent.body.message.reviewer.questionType).toBe('mixed');
        for (const leak of ['"accepted"', '"items"', ...SECRETS]) expect(JSON.stringify(sent.body), leak).not.toContain(leak);
        const stored = await groupMessageModel.findById(sent.body.message._id).select('+reviewerContent').lean();
        expect(stored.reviewerContent.questions.find((q) => q.type === 'id' && q.answer === 'Quokka').accepted).toEqual(['Marsupial']);

        const saved = await bob.post(`/api/groups/${group._id}/messages/${sent.body.message._id}/save`);
        expect(saved.status).toBe(201);
        const copy = await reviewerModel.findById(saved.body.saved._id);
        expect(copy.questionType).toBe('mixed');
        const byType = Object.fromEntries(copy.questions.map((q) => [q.type + (q.answer || ''), q]));
        expect(byType.idQuokka.accepted).toEqual(['Marsupial']);
        expect(byType.fillWombat.prompt).toContain('_____');
        expect(byType.enum.items.map((i) => i.answer)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta']);
        expect(byType.tf.correctIndex).toBe(1);

        // And the copy can be studied: a typed answer is graded.
        const { find, answer } = await startSession(bob, String(copy._id));
        expect((await answer(find('Which small marsupial'), { text: 'quokka' })).body.result.correct).toBe(true);
    });
});
