import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import request from 'supertest';
import app from '../app.js';
import reviewerModel from '../models/reviewerModel.js';
import reviewerAttemptModel from '../models/reviewerAttemptModel.js';
import aiRequestModel from '../models/aiRequestModel.js';
import userModel from '../models/userModel.js';
import { generateJson } from '../utils/gemini.js';
import { WEAK_BELOW, STRONG_FROM } from '../utils/reviewerProgress.js';
import { MAX_SOURCE_CHARS } from '../utils/pdfText.js';
import { generationSettings, settleGenerationJobs, STALE_AFTER_MS } from '../controllers/reviewerController.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';
import { makePdf, makePagedPdf, makeImageOnlyPdf, STUDY_LINES } from './helpers/pdf.js';

// The checks from the thesis test plan that the other reviewer tests don't already cover:
// exact scores, topic scores and weak topics, when Gemini is (and isn't) called, refreshing in
// the middle of a session, real PDFs, and what ends up in the database.

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

const HANDOUT = readFileSync(new URL('./fixtures/stress-handout.pdf', import.meta.url));

// A reviewer with `spec` = [[topic, questionCount], ...]. The right answer is written first;
// the server shuffles it.
const output = (spec) => ({
    title: 'Generated title',
    summary: 'What the material covers.',
    topics: spec.map(([name]) => ({ name, summary: `About ${name}.` })),
    keyPoints: ['A key point.'],
    keyTerms: [{ term: 'A term', definition: 'What it means.' }],
    questions: spec.flatMap(([topic, n]) => Array.from({ length: n }, (_, i) => ({
        topic,
        prompt: `${topic}, question ${i + 1}?`,
        options: [`${topic} ${i} right`, `${topic} ${i} wrong one`, `${topic} ${i} wrong two`, `${topic} ${i} wrong three`],
        correctIndex: 0,
        explanation: `Because of ${topic} point ${i + 1}.`,
        difficulty: ['easy', 'medium', 'hard'][i % 3],
    }))),
});
const TEN = [['Topic A', 4], ['Topic B', 3], ['Topic C', 3]];

beforeAll(async () => {
    generationSettings.retryDelaysMs = [0, 0, 0];
    await connectTestDB();
});
beforeEach(async () => {
    await clearTestDB();
    generateJson.mockReset();
    generateJson.mockResolvedValue({ data: output(TEN), model: 'gemini-test' });
});
afterAll(closeTestDB);

const signUp = async (email = 'alice@student.fatima.edu.ph', name = 'Alice') => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email, name }));
    return agent;
};
const userId = async (email = 'alice@student.fatima.edu.ph') => (await userModel.findOne({ email }))._id;

const upload = (agent, { file = makePdf(STUDY_LINES), filename = 'Notes.pdf', fields = {} } = {}) => {
    let req = agent.post('/api/reviewers');
    for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
    return req.attach('pdf', file, { filename, contentType: 'application/pdf' });
};
const makeReady = async (agent, options) => {
    const res = await upload(agent, options);
    expect(res.status).toBe(201);
    await settleGenerationJobs();
    return res.body.reviewer._id;
};
const answerKey = async (id) => new Map((await reviewerModel.findById(id)).questions.map((q) => [String(q._id), q]));
const startSession = async (agent, id, mode) => {
    const res = await agent.post(`/api/reviewers/${id}/sessions`).send(mode ? { mode } : {});
    expect(res.status).toBe(201);
    return res.body.session;
};
// Answers the questions in the order served. `pickRight(question, i)` says which to get right.
const answerAll = async (agent, id, session, pickRight) => {
    const key = await answerKey(id);
    for (const [i, q] of session.questions.entries()) {
        const right = key.get(q._id).correctIndex;
        const res = await agent.post(`/api/reviewers/${id}/sessions/${session._id}/answer`)
            .send({ questionId: q._id, choice: pickRight(q, i) ? right : (right + 1) % 4 });
        expect(res.status).toBe(200);
    }
};
const finish = (agent, id, session, body = {}) => agent.post(`/api/reviewers/${id}/sessions/${session._id}/finish`).send(body);

describe('scores are worked out on the server', () => {
    test.each([
        [10, 100],
        [8, 80],
        [5, 50],
        [0, 0],
    ])('%i of 10 right is %i%%', async (right, score) => {
        const alice = await signUp();
        const id = await makeReady(alice);
        const session = await startSession(alice, id);
        expect(session.total).toBe(10);
        await answerAll(alice, id, session, (_, i) => i < right);

        const done = await finish(alice, id, session);
        expect(done.body.session).toMatchObject({ correct: right, answered: 10, total: 10, score });
        expect(done.body.review.filter((r) => r.correct)).toHaveLength(right);
        expect(done.body.review.filter((r) => !r.correct)).toHaveLength(10 - right);
        const stored = await reviewerAttemptModel.findById(session._id);
        expect(stored).toMatchObject({ correct: right, answered: 10, total: 10, score });
        expect((await alice.get('/api/reviewers')).body.reviewers[0].lastScore).toBe(score);
    });

    test('per-topic scores add up for the session', async () => {
        const alice = await signUp();
        const id = await makeReady(alice);
        const session = await startSession(alice, id);
        // Topic A: 4 of 4, Topic B: 1 of 3, Topic C: 2 of 3.
        const quota = { 'Topic A': 4, 'Topic B': 1, 'Topic C': 2 };
        await answerAll(alice, id, session, (q) => quota[q.topic]-- > 0);

        const done = (await finish(alice, id, session)).body;
        const stats = Object.fromEntries(done.session.topicStats.map((t) => [t.topic, [t.correct, t.total]]));
        expect(stats).toEqual({ 'Topic A': [4, 4], 'Topic B': [1, 3], 'Topic C': [2, 3] });
        expect(done.session).toMatchObject({ correct: 7, answered: 10, score: 70 });
        const levels = Object.fromEntries(done.progress.topics.map((t) => [t.name, t.level]));
        expect(levels).toEqual({ 'Topic A': 'strong', 'Topic B': 'weak', 'Topic C': 'fair' });
    });

    test('a score, correct flag or topic stats sent by the browser are ignored', async () => {
        const alice = await signUp();
        const id = await makeReady(alice);
        const session = await startSession(alice, id);
        const key = await answerKey(id);
        const q = session.questions[0];
        const wrong = (key.get(q._id).correctIndex + 1) % 4;
        const res = await alice.post(`/api/reviewers/${id}/sessions/${session._id}/answer`)
            .send({ questionId: q._id, choice: wrong, correct: true, correctIndex: wrong });
        expect(res.body.result.correct).toBe(false);

        const done = await finish(alice, id, session, {
            score: 100, correct: 10, answered: 10, total: 10, topicStats: [{ topic: 'Topic A', correct: 4, total: 4 }],
        });
        expect(done.body.session).toMatchObject({ correct: 0, answered: 1, total: 10, score: 0 });
        expect(done.body.session.topicStats).toHaveLength(1);
        expect(done.body.session.topicStats[0]).toMatchObject({ correct: 0, total: 1 });
    });

    test('ending early scores only what was answered', async () => {
        const alice = await signUp();
        const id = await makeReady(alice);
        const session = await startSession(alice, id);
        const key = await answerKey(id);
        for (const q of session.questions.slice(0, 4)) {
            await alice.post(`/api/reviewers/${id}/sessions/${session._id}/answer`).send({ questionId: q._id, choice: key.get(q._id).correctIndex });
        }
        const done = (await finish(alice, id, session)).body;
        expect(done.session).toMatchObject({ correct: 4, answered: 4, total: 10, score: 100 });
        expect(done.review).toHaveLength(4);
    });
});

describe('weak topics', () => {
    test(`the threshold is defined in code: under ${WEAK_BELOW * 100}% is weak, ${STRONG_FROM * 100}% and up is strong`, () => {
        expect(WEAK_BELOW).toBe(0.6);
        expect(STRONG_FROM).toBe(0.8);
    });

    test('90%, 40% and 80% on three topics: only the 40% one is weak', async () => {
        generateJson.mockResolvedValue({ data: output([['Topic A', 10], ['Topic B', 10], ['Topic C', 5]]), model: 'gemini-test' });
        const alice = await signUp();
        const id = await makeReady(alice, { fields: { questionCount: '30' } });
        const session = await startSession(alice, id);
        expect(session.total).toBe(25);
        const quota = { 'Topic A': 9, 'Topic B': 4, 'Topic C': 4 };
        await answerAll(alice, id, session, (q) => quota[q.topic]-- > 0);

        const done = (await finish(alice, id, session)).body;
        const topics = Object.fromEntries(done.progress.topics.map((t) => [t.name, t]));
        expect(topics['Topic A']).toMatchObject({ correct: 9, answered: 10, accuracy: 0.9, level: 'strong' });
        expect(topics['Topic B']).toMatchObject({ correct: 4, answered: 10, accuracy: 0.4, level: 'weak' });
        expect(topics['Topic C']).toMatchObject({ correct: 4, answered: 5, accuracy: 0.8, level: 'strong' });
        expect(done.progress.weakTopics).toEqual(['Topic B']);
        expect(done.session.score).toBe(68); // 17 of 25

        // Practising weak topics serves Topic B's 10 questions and nothing else.
        const weak = await startSession(alice, id, 'weak');
        expect(weak.questions).toHaveLength(10);
        expect(new Set(weak.questions.map((q) => q.topic))).toEqual(new Set(['Topic B']));
    });

    test('exactly 60% is not weak', async () => {
        generateJson.mockResolvedValue({ data: output([['Topic A', 5], ['Topic B', 5]]), model: 'gemini-test' });
        const alice = await signUp();
        const id = await makeReady(alice);
        const session = await startSession(alice, id);
        const quota = { 'Topic A': 3, 'Topic B': 2 };
        await answerAll(alice, id, session, (q) => quota[q.topic]-- > 0);
        const done = (await finish(alice, id, session)).body;
        expect(done.progress.weakTopics).toEqual(['Topic B']);
        expect(done.progress.topics.find((t) => t.name === 'Topic A').level).toBe('fair');
    });
});

describe('Gemini is only called to make content', () => {
    test('opening, studying, answering and viewing results never call it', async () => {
        const alice = await signUp();
        const id = await makeReady(alice);
        expect(generateJson).toHaveBeenCalledTimes(1);

        await alice.get('/api/reviewers').expect(200);
        await alice.get(`/api/reviewers/${id}`).expect(200);
        await alice.get(`/api/reviewers/${id}/status`).expect(200);
        await alice.get(`/api/reviewers/${id}/progress`).expect(200);
        await alice.patch(`/api/reviewers/${id}`).send({ title: 'Renamed' }).expect(200);

        const session = await startSession(alice, id);
        await alice.get(`/api/reviewers/${id}/sessions/${session._id}`).expect(200);
        await answerAll(alice, id, session, (q) => q.topic !== 'Topic B');
        await finish(alice, id, session).expect(200);
        await finish(alice, id, session).expect(200);
        await startSession(alice, id, 'weak');
        await alice.get(`/api/reviewers/${id}/progress`).expect(200);
        // Reopening later, as on a new visit.
        await alice.get(`/api/reviewers/${id}`).expect(200);
        expect(generateJson).toHaveBeenCalledTimes(1);

        // Only asking for more does.
        generateJson.mockResolvedValueOnce({ data: { questions: output([['Topic B', 5]]).questions.map((q) => ({ ...q, prompt: `New ${q.prompt}` })) }, model: 'gemini-test' });
        await alice.post(`/api/reviewers/${id}/targeted`).send({ topics: ['Topic B'] }).expect(202);
        await settleGenerationJobs();
        expect(generateJson).toHaveBeenCalledTimes(2);
        await alice.post(`/api/reviewers/${id}/regenerate`).send({}).expect(200);
        await settleGenerationJobs();
        expect(generateJson).toHaveBeenCalledTimes(3);
        expect(await aiRequestModel.countDocuments()).toBe(3);

        await alice.delete(`/api/reviewers/${id}`).expect(200);
        expect(generateJson).toHaveBeenCalledTimes(3);
    });
});

describe('the answer key stays on the server until a question is answered', () => {
    test('nothing before answering includes it', async () => {
        const alice = await signUp();
        const id = await makeReady(alice);
        const leaks = /correctIndex|explanation|sourceText|jobId/;
        const session = await startSession(alice, id);
        for (const res of [
            await alice.get('/api/reviewers'),
            await alice.get(`/api/reviewers/${id}`),
            await alice.get(`/api/reviewers/${id}/status`),
            await alice.get(`/api/reviewers/${id}/progress`),
            await alice.get(`/api/reviewers/${id}/sessions/${session._id}`),
        ]) {
            expect(JSON.stringify(res.body)).not.toMatch(leaks);
        }
        expect(JSON.stringify(session)).not.toMatch(leaks);

        // After one answer, only that question's answer comes back.
        await alice.post(`/api/reviewers/${id}/sessions/${session._id}/answer`).send({ questionId: session.questions[0]._id, choice: 0 });
        const resumed = (await alice.get(`/api/reviewers/${id}/sessions/${session._id}`)).body.session;
        expect(resumed.answers).toHaveLength(1);
        expect(resumed.answers[0].questionId).toBe(session.questions[0]._id);
        expect(JSON.stringify(resumed.questions)).not.toMatch(leaks);
    });
});

describe('refreshing in the middle of a session', () => {
    test('picks up where it left off, and the last answer saves the session even without the results page', async () => {
        const alice = await signUp();
        const id = await makeReady(alice);
        const session = await startSession(alice, id);
        const key = await answerKey(id);
        const base = `/api/reviewers/${id}/sessions/${session._id}`;
        for (const q of session.questions.slice(0, 3)) {
            await alice.post(`${base}/answer`).send({ questionId: q._id, choice: key.get(q._id).correctIndex });
        }

        // "Refresh": the reviewer offers to resume, and the session comes back as it was.
        expect((await alice.get(`/api/reviewers/${id}`)).body.openSession).toMatchObject({ _id: session._id, answered: 3, total: 10 });
        const resumed = (await alice.get(base)).body.session;
        expect(resumed.questions.map((q) => q._id)).toEqual(session.questions.map((q) => q._id));
        expect(resumed.answers.map((a) => a.questionId)).toEqual(session.questions.slice(0, 3).map((q) => q._id));

        // Answer the rest; the last answer closes it.
        let last;
        for (const q of session.questions.slice(3)) {
            last = await alice.post(`${base}/answer`).send({ questionId: q._id, choice: (key.get(q._id).correctIndex + 1) % 4 });
        }
        expect(last.body).toMatchObject({ answered: 10, total: 10 });
        const stored = await reviewerAttemptModel.findById(session._id);
        expect(stored.finishedAt).not.toBeNull();
        expect(stored).toMatchObject({ correct: 3, answered: 10, score: 30 });

        // Left before "See results": it still counts, and nothing is offered to resume.
        const reopened = (await alice.get(`/api/reviewers/${id}`)).body;
        expect(reopened.openSession).toBeNull();
        expect((await alice.get(`/api/reviewers/${id}/progress`)).body.progress).toMatchObject({ sessions: 1, lastScore: 30 });

        // A retry of the last answer (say the response got lost) gets the same result, not an error.
        const lastQ = session.questions.at(-1);
        const retry = await alice.post(`${base}/answer`).send({ questionId: lastQ._id, choice: key.get(lastQ._id).correctIndex });
        expect(retry.status).toBe(200);
        expect(retry.body.result.correct).toBe(false);
        // The results page still works after.
        expect((await finish(alice, id, session)).body.session).toMatchObject({ correct: 3, answered: 10, score: 30 });
    });

    test('a closed session takes no new answers and keeps its result', async () => {
        const alice = await signUp();
        const id = await makeReady(alice);
        const session = await startSession(alice, id);
        const base = `/api/reviewers/${id}/sessions/${session._id}`;
        await alice.post(`${base}/answer`).send({ questionId: session.questions[0]._id, choice: 0 });
        const done = (await finish(alice, id, session)).body.session;
        expect((await alice.post(`${base}/answer`).send({ questionId: session.questions[1]._id, choice: 0 })).status).toBe(409);
        expect((await finish(alice, id, session)).body.session).toEqual(done);
    });

    test("another student can't open or answer someone's session", async () => {
        const alice = await signUp();
        const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
        const id = await makeReady(alice);
        const session = await startSession(alice, id);
        const base = `/api/reviewers/${id}/sessions/${session._id}`;
        expect((await bob.get(base)).status).toBe(404);
        expect((await bob.post(`${base}/answer`).send({ questionId: session.questions[0]._id, choice: 0 })).status).toBe(404);
        expect((await bob.post(`${base}/finish`).send({})).status).toBe(404);
        expect((await bob.get(`/api/reviewers/${id}/progress`)).status).toBe(404);
        expect((await bob.post(`/api/reviewers/${id}/regenerate`).send({})).status).toBe(404);
        expect((await reviewerAttemptModel.findById(session._id)).answers).toHaveLength(0);
    });
});

describe('real PDFs', () => {
    test('a handout printed from a browser: headings, a table, two columns, Filipino words, 3 pages', async () => {
        const alice = await signUp();
        const res = await upload(alice, { file: HANDOUT, filename: 'PSY 101 Module 4.pdf' });
        expect(res.status).toBe(201);
        expect(res.body.reviewer.source).toMatchObject({ fileName: 'PSY 101 Module 4.pdf', pages: 3, truncated: false });
        await settleGenerationJobs();

        const { prompt } = generateJson.mock.calls[0][0];
        expect(prompt).toContain('PSY 101 – Stress and Coping'); // title heading
        expect(prompt).toContain('3. General Adaptation Syndrome'); // heading on page 2
        expect(prompt).toContain('Resistance The body stays on alert'); // a table row
        expect(prompt).toMatch(/Problem-focused coping[\s\S]+Emotion-focused coping/); // columns in order
        expect(prompt).toContain('Parañaque or Las Piñas');
        expect(prompt).toContain('27–40'); // last page
        expect(prompt).not.toMatch(/\n{3,}/);
    });

    test('a multi-page PDF keeps every page, in order', async () => {
        const alice = await signUp();
        const pages = [STUDY_LINES.slice(0, 5), STUDY_LINES.slice(5, 10), STUDY_LINES.slice(10), ['Summary page: plants and cells both handle energy.']];
        const res = await upload(alice, { file: makePagedPdf(pages) });
        expect(res.body.reviewer.source.pages).toBe(4);
        await settleGenerationJobs();
        const { prompt } = generateJson.mock.calls[0][0];
        expect(prompt.indexOf('Photosynthesis converts')).toBeLessThan(prompt.indexOf('Summary page'));
    });

    test('files that are not usable PDFs get a clear message, and nothing is saved or sent', async () => {
        const alice = await signUp();
        const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200)]);
        const cases = [
            ['a PNG renamed to .pdf', png, 400, /isn't a PDF/],
            ['an empty file', Buffer.alloc(0), 400, /isn't a PDF|Choose a PDF/],
            ['a damaged PDF (cut in half)', HANDOUT.subarray(0, Math.floor(HANDOUT.length / 2)), 422, /may be damaged/],
            ['a PDF with only the header', Buffer.from('%PDF-1.7\n'), 422, /may be damaged/],
            ['a password-protected PDF', makePagedPdf([STUDY_LINES], { encrypt: true }), 422, /password protected/],
            ['a scanned (image-only) PDF', makeImageOnlyPdf(), 422, /enough text[\s\S]*Scanned/],
            ['a PDF with one short line', makePdf(['Just one short line.']), 422, /enough text/],
        ];
        for (const [label, file, status, message] of cases) {
            const res = await upload(alice, { file });
            expect(res.status, label).toBe(status);
            expect(res.body.message, label).toMatch(message);
            expect(res.body.success, label).toBe(false);
        }
        expect(await reviewerModel.countDocuments()).toBe(0);
        expect(await aiRequestModel.countDocuments()).toBe(0);
        expect(generateJson).not.toHaveBeenCalled();
    });

    test('a very long PDF is cut at the limit, says so, and goes to Gemini in three parts', async () => {
        generateJson.mockImplementation(async ({ prompt }) => {
            const share = Number(prompt.match(/exactly (\d+) multiple-choice/)[1]);
            const part = prompt.match(/This is part (\d) of 3/)?.[1];
            const data = output([[`Chapter ${part}`, share]]);
            return { data: { ...data, questions: data.questions.map((q) => ({ ...q, prompt: `Part ${part}: ${q.prompt}` })) }, model: 'gemini-test' };
        });
        const line = 'The mitochondria make ATP through cellular respiration in every living cell today.'; // 84 chars
        const pages = Array.from({ length: 80 }, (_, p) => Array.from({ length: 56 }, (_, l) => `${p}.${l} ${line}`));
        const alice = await signUp();
        const res = await upload(alice, { file: makePagedPdf(pages), fields: { questionCount: '15' } });
        expect(res.status).toBe(201);
        expect(res.body.reviewer.source.pages).toBe(80);
        expect(res.body.reviewer.source.chars).toBeGreaterThan(MAX_SOURCE_CHARS);
        expect(res.body.reviewer.source.truncated).toBe(true);
        await settleGenerationJobs();

        expect(generateJson).toHaveBeenCalledTimes(3);
        const stored = await reviewerModel.findById(res.body.reviewer._id).select('+sourceText');
        expect(stored.sourceText.length).toBe(MAX_SOURCE_CHARS);
        expect(stored).toMatchObject({ status: 'ready' });
        expect(stored.questions).toHaveLength(15);
        expect(stored.topics.map((t) => t.name)).toEqual(['Chapter 1', 'Chapter 2', 'Chapter 3']);
    }, 60000);
});

describe('what Gemini sends back is checked before it is saved', () => {
    const good = output(TEN);
    const withQuestions = (questions) => ({ data: { ...good, questions }, model: 'gemini-test' });

    test('bad questions are dropped and every stored question is well formed', async () => {
        generateJson.mockResolvedValue(withQuestions([
            ...good.questions.slice(0, 6),
            { ...good.questions[6], options: ['Only', 'three', 'options'] },
            { ...good.questions[7], options: ['Same', 'same', 'Other', 'Another'] },
            { ...good.questions[8], correctIndex: 4 }, // points past the choices
            { ...good.questions[9], correctIndex: '1' }, // not a number
            { ...good.questions[9], prompt: 'No explanation?', explanation: '' },
            { ...good.questions[9], prompt: 'Empty choice?', options: ['A', '', 'C', 'D'] },
            { ...good.questions[9], prompt: '' },
            { ...good.questions[0], prompt: 'Topic A, question 1' }, // a repeat
            { ...good.questions[9], prompt: 'Odd difficulty?', difficulty: 'extreme' },
        ]));
        const alice = await signUp();
        const id = await makeReady(alice);
        const stored = await reviewerModel.findById(id);
        expect(stored.status).toBe('ready');
        expect(stored.questions.map((q) => q.prompt)).toEqual([...good.questions.slice(0, 6).map((q) => q.prompt), 'Odd difficulty?']);

        const topicNames = stored.topics.map((t) => t.name);
        const originals = new Map([...good.questions, { ...good.questions[9], prompt: 'Odd difficulty?' }].map((q) => [q.prompt, q]));
        for (const q of stored.questions) {
            expect(q.options).toHaveLength(4);
            expect(new Set(q.options).size).toBe(4);
            expect(Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex <= 3).toBe(true);
            // After shuffling, the stored answer is still the option the AI marked right.
            const original = originals.get(q.prompt);
            expect(q.options[q.correctIndex]).toBe(original.options[original.correctIndex]);
            expect(q.explanation.length).toBeGreaterThan(0);
            expect(topicNames).toContain(q.topic);
            expect(['easy', 'medium', 'hard']).toContain(q.difficulty);
        }
        expect(stored.questions.at(-1).difficulty).toBe('medium');
    });

    test.each([
        ['no questions at all', { ...good, questions: undefined }],
        ['an empty question list', { ...good, questions: [] }],
        ['questions that are all unusable', { ...good, questions: good.questions.map((q) => ({ ...q, correctIndex: 9 })) }],
        ['not an object', 'Here is your reviewer!'],
    ])('%s: asked again, then a plain failure', async (_, data) => {
        generateJson.mockResolvedValue({ data, model: 'gemini-test' });
        const alice = await signUp();
        const id = (await upload(alice)).body.reviewer._id;
        await settleGenerationJobs();
        expect(generateJson).toHaveBeenCalledTimes(4);
        const stored = await reviewerModel.findById(id);
        expect(stored).toMatchObject({ status: 'failed', version: 0 });
        expect(stored.error).toMatch(/couldn't get good questions/);
        expect(stored.questions).toHaveLength(0);
    });

    test.each([
        ['an empty answer', Object.assign(new Error('Gemini returned an empty response (SAFETY).'), { code: 'invalid_output' }), 4, /couldn't get good questions/],
        ['a timeout', Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }), 4, /took too long/],
        ['Gemini being unavailable', Object.assign(new Error('{"error":{"code":503}}'), { status: 503 }), 4, /had a problem/],
        ['an invalid key', Object.assign(new Error('{"error":{"message":"API key not valid."}}'), { status: 400 }), 1, /aren't working on our side/],
        ['a blocked key', Object.assign(new Error('{"error":{"code":403}}'), { status: 403 }), 1, /aren't working on our side/],
    ])('%s fails the reviewer with a message a student can act on', async (_, error, calls, message) => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        generateJson.mockRejectedValue(error);
        const alice = await signUp();
        const id = (await upload(alice)).body.reviewer._id;
        await settleGenerationJobs();
        expect(generateJson).toHaveBeenCalledTimes(calls);
        const status = (await alice.get(`/api/reviewers/${id}/status`)).body;
        expect(status.status).toBe('failed');
        expect(status.error).toMatch(message);
        expect(status.error).not.toMatch(/API key|503|aborted|SAFETY/);
        log.mockRestore();
    });
});

describe('database records', () => {
    test('reviewers and sessions point at the right student and reviewer', async () => {
        const alice = await signUp();
        const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
        const aliceReviewer = await makeReady(alice);
        const bobReviewer = await makeReady(bob);
        const aliceSession = await startSession(alice, aliceReviewer);
        const bobSession = await startSession(bob, bobReviewer);

        expect(String((await reviewerModel.findById(aliceReviewer)).owner)).toBe(String(await userId()));
        expect(String((await reviewerModel.findById(bobReviewer)).owner)).toBe(String(await userId('bob@student.fatima.edu.ph')));
        const stored = await reviewerAttemptModel.findById(aliceSession._id);
        expect(String(stored.user)).toBe(String(await userId()));
        expect(String(stored.reviewer)).toBe(aliceReviewer);
        // Every question in a session belongs to its reviewer.
        const ids = new Set((await reviewerModel.findById(aliceReviewer)).questions.map((q) => String(q._id)));
        expect(stored.questions.every((q) => ids.has(String(q)))).toBe(true);

        // Deleting Alice's reviewer removes her sessions on it, and nothing of Bob's.
        await alice.delete(`/api/reviewers/${aliceReviewer}`).expect(200);
        expect(await reviewerAttemptModel.countDocuments({ _id: aliceSession._id })).toBe(0);
        expect(await reviewerAttemptModel.countDocuments({ _id: bobSession._id })).toBe(1);
        expect(await reviewerModel.countDocuments()).toBe(1);
    });

    test('a double submit of the same upload makes one reviewer and one AI request', async () => {
        const alice = await signUp();
        let release;
        generateJson.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ data: output(TEN), model: 'gemini-test' }); }));
        const first = await upload(alice);
        const second = await upload(alice);
        expect(first.status).toBe(201);
        expect(second.status).toBe(200);
        expect(second.body.reviewer._id).toBe(first.body.reviewer._id);
        await vi.waitFor(() => expect(release).toBeTypeOf('function'));
        release();
        await settleGenerationJobs();
        expect(await reviewerModel.countDocuments()).toBe(1);
        expect(await aiRequestModel.countDocuments()).toBe(1);

        // Uploading it again on purpose later (once the first is done) makes a new one.
        expect((await upload(alice)).status).toBe(201);
        await settleGenerationJobs();
        expect(await reviewerModel.countDocuments()).toBe(2);
        // So does the same file with a different question count.
        expect((await upload(alice, { fields: { questionCount: '20' } })).status).toBe(201);
        await settleGenerationJobs();
    });

    test('a failed first attempt leaves a clean "failed" record that can be retried or deleted', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        generateJson.mockRejectedValue(Object.assign(new Error('busy'), { status: 429 }));
        const alice = await signUp();
        const id = (await upload(alice)).body.reviewer._id;
        await settleGenerationJobs();
        const stored = await reviewerModel.findById(id).select('+sourceText');
        expect(stored).toMatchObject({ status: 'failed', version: 0, jobId: '' });
        expect(stored.questions).toHaveLength(0);
        expect(stored.topics).toHaveLength(0);
        expect(stored.sourceText.length).toBeGreaterThan(300);
        expect((await alice.post(`/api/reviewers/${id}/sessions`).send({})).status).toBe(409);
        expect(await reviewerAttemptModel.countDocuments()).toBe(0);
        log.mockRestore();
    });

    test('when "New questions" fails, the reviewer keeps the questions it had', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        const alice = await signUp();
        const id = await makeReady(alice);
        const before = await reviewerModel.findById(id);
        const session = await startSession(alice, id);
        await alice.post(`/api/reviewers/${id}/sessions/${session._id}/answer`).send({ questionId: session.questions[0]._id, choice: 0 });

        generateJson.mockRejectedValue(Object.assign(new Error('down'), { status: 503 }));
        await alice.post(`/api/reviewers/${id}/regenerate`).send({ questionCount: 20 }).expect(200);
        await settleGenerationJobs();

        const status = (await alice.get(`/api/reviewers/${id}/status`)).body;
        expect(status).toMatchObject({ status: 'ready', version: 1 });
        expect(status.error).toMatch(/had a problem/);
        const after = await reviewerModel.findById(id);
        expect(after.questions.map((q) => String(q._id))).toEqual(before.questions.map((q) => String(q._id)));
        // The session that was open still works.
        const next = await alice.post(`/api/reviewers/${id}/sessions/${session._id}/answer`).send({ questionId: session.questions[1]._id, choice: 0 });
        expect(next.status).toBe(200);

        // A later success clears the message.
        generateJson.mockResolvedValue({ data: output(TEN), model: 'gemini-test' });
        await alice.post(`/api/reviewers/${id}/regenerate`).send({}).expect(200);
        await settleGenerationJobs();
        expect((await alice.get(`/api/reviewers/${id}/status`)).body).toMatchObject({ status: 'ready', version: 2, error: '' });
        log.mockRestore();
    });

    test('a reviewer stuck making new questions (server restarted) goes back to the ones it had', async () => {
        const alice = await signUp();
        const id = await makeReady(alice);
        await reviewerModel.updateOne({ _id: id }, { status: 'processing', jobId: 'gone', requestedAt: new Date(Date.now() - STALE_AFTER_MS - 1000) });
        const got = (await alice.get(`/api/reviewers/${id}`)).body.reviewer;
        expect(got).toMatchObject({ status: 'ready', questionCount: 10 });
        expect(got.error).toMatch(/too long/);
    });
});
