import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import reviewerModel from '../models/reviewerModel.js';
import reviewerAttemptModel from '../models/reviewerAttemptModel.js';
import aiRequestModel from '../models/aiRequestModel.js';
import userModel from '../models/userModel.js';
import { generateJson, isGeminiConfigured } from '../utils/gemini.js';
import { generationSettings, settleGenerationJobs, DAILY_GENERATION_LIMIT, STALE_AFTER_MS } from '../controllers/reviewerController.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';
import { makePdf, STUDY_LINES } from './helpers/pdf.js';

vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
}));
// Never call the real Gemini API from tests. PDF extraction is real.
vi.mock('../utils/gemini.js', () => ({
    generateJson: vi.fn(),
    isGeminiConfigured: vi.fn(() => true),
}));

const PDF = makePdf(STUDY_LINES);

// Two topics, six questions. The correct answer is always written first; the server shuffles.
const aiOutput = () => ({
    summary: 'How plants make sugar and how cells use it.',
    topics: [{ name: 'Photosynthesis', summary: 'Light to sugar.' }, { name: 'Respiration', summary: 'Sugar to ATP.' }],
    keyPoints: ['Chlorophyll absorbs red and blue light.', 'Oxygen is the final electron acceptor.'],
    keyTerms: [{ term: 'RuBisCO', definition: 'The enzyme that captures carbon dioxide.' }],
    questions: [
        ['Photosynthesis', 'Where do the light-dependent reactions happen?', ['Thylakoid membranes', 'Stroma', 'Cytoplasm', 'Nucleus']],
        ['Photosynthesis', 'What does chlorophyll absorb?', ['Red and blue light', 'Only green light', 'Heat', 'Oxygen']],
        ['Photosynthesis', 'Where does the Calvin cycle happen?', ['Stroma', 'Thylakoid', 'Cytoplasm', 'Matrix']],
        ['Respiration', 'Where does glycolysis happen?', ['Cytoplasm', 'Nucleus', 'Stroma', 'Matrix']],
        ['Respiration', 'What is the final electron acceptor?', ['Oxygen', 'Carbon dioxide', 'Water', 'Glucose']],
        ['Respiration', 'What happens without oxygen?', ['Fermentation', 'More ATP', 'Photosynthesis', 'Nothing']],
    ].map(([topic, prompt, options]) => ({ topic, prompt, options, correctIndex: 0, explanation: `Because: ${options[0]}.`, difficulty: 'medium' })),
});

beforeAll(async () => {
    generationSettings.retryDelaysMs = [0, 0];
    await connectTestDB();
});
beforeEach(async () => {
    await clearTestDB();
    generateJson.mockReset();
    generateJson.mockResolvedValue({ data: aiOutput(), model: 'gemini-test' });
    isGeminiConfigured.mockReturnValue(true);
});
afterAll(closeTestDB);

const signUp = async (email, name) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email, name }));
    return agent;
};

const upload = (agent, { file = PDF, filename = 'Biology notes.pdf', fields = {} } = {}) => {
    let req = agent.post('/api/reviewers');
    for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
    return file ? req.attach('pdf', file, { filename, contentType: 'application/pdf' }) : req;
};

// Uploads and waits for the background generation to finish.
const makeReady = async (agent, fields) => {
    const res = await upload(agent, { fields });
    expect(res.status).toBe(201);
    await settleGenerationJobs();
    return res.body.reviewer._id;
};

const answerKey = async (reviewerId) => {
    const r = await reviewerModel.findById(reviewerId);
    return new Map(r.questions.map((q) => [String(q._id), q]));
};

describe('uploading a PDF', () => {
    test('creates a reviewer that is processing, then ready', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const res = await upload(alice, { fields: { course: 'BIO 101', questionCount: '10' } });
        expect(res.status).toBe(201);
        expect(res.body.reviewer).toMatchObject({ title: 'Biology notes', course: 'BIO 101', status: 'processing', questionTarget: 10 });
        expect(res.body.reviewer.source).toMatchObject({ fileName: 'Biology notes.pdf', pages: 1, truncated: false });

        await settleGenerationJobs();
        const prompt = generateJson.mock.calls[0][0].prompt;
        expect(prompt).toContain('RuBisCO captures carbon dioxide');
        expect(prompt).toContain('exactly 10 multiple-choice questions');

        const got = await alice.get(`/api/reviewers/${res.body.reviewer._id}`);
        expect(got.body.reviewer).toMatchObject({ status: 'ready', version: 1, questionCount: 6, aiModel: 'gemini-test' });
        expect(got.body.reviewer.summary).toContain('plants');
        expect(got.body.reviewer.topics).toHaveLength(2);
        // The answer key never goes out with the reviewer.
        expect(JSON.stringify(got.body)).not.toMatch(/correctIndex|explanation|sourceText/);
    });

    test('a title from the form wins over the file name', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const res = await upload(alice, { fields: { title: '  Midterm   review ' } });
        expect(res.body.reviewer.title).toBe('Midterm review');
        await settleGenerationJobs();
    });

    test('rejects a missing file, a non-PDF, a bad count and an empty PDF', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        expect((await upload(alice, { file: null })).status).toBe(400);
        const notPdf = await upload(alice, { file: Buffer.from('hello there, plain text'), filename: 'notes.pdf' });
        expect(notPdf.status).toBe(400);
        expect(notPdf.body.message).toMatch(/isn't a PDF/);
        const wrongType = await alice.post('/api/reviewers').attach('pdf', Buffer.from('x'), { filename: 'notes.docx', contentType: 'application/msword' });
        expect(wrongType.status).toBe(400);
        expect(wrongType.body.message).toMatch(/Only PDF/);
        expect((await upload(alice, { fields: { questionCount: '7' } })).status).toBe(400);
        const empty = await upload(alice, { file: makePdf(['Just one short line.']) });
        expect(empty.status).toBe(422);
        expect(empty.body.message).toMatch(/enough text/);
        expect(await reviewerModel.countDocuments()).toBe(0);
        expect(generateJson).not.toHaveBeenCalled();
    });

    test('rejects a PDF over 10 MB', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(10 * 1024 * 1024)]);
        const res = await upload(alice, { file: big });
        expect(res.status).toBe(413);
        expect(res.body.success).toBe(false);
    });

    test('says so when the server has no Gemini key', async () => {
        isGeminiConfigured.mockReturnValue(false);
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const res = await upload(alice);
        expect(res.status).toBe(503);
        const list = await alice.get('/api/reviewers');
        expect(list.body.enabled).toBe(false);
    });

    test(`stops at ${DAILY_GENERATION_LIMIT} a day, even after deleting`, async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const user = await userModel.findOne({ email: 'alice@student.fatima.edu.ph' });
        await aiRequestModel.insertMany(Array.from({ length: DAILY_GENERATION_LIMIT }, () => ({ user: user._id })));
        const res = await upload(alice);
        expect(res.status).toBe(429);
        expect(res.body.message).toMatch(/last 24 hours/);
        // Yesterday's requests don't count.
        await aiRequestModel.updateMany({}, { at: new Date(Date.now() - 25 * 60 * 60 * 1000) });
        expect((await upload(alice)).status).toBe(201);
        await settleGenerationJobs();
    });

    test('needs a session', async () => {
        const res = await request(app).get('/api/reviewers');
        expect(res.body.success).toBe(false);
        const up = await upload(request(app));
        expect(up.body.success).toBe(false);
        expect(await reviewerModel.countDocuments()).toBe(0);
    });
});

describe('when the AI fails', () => {
    test('retries a busy service, then fails with a plain message', async () => {
        generateJson.mockRejectedValue(Object.assign(new Error('quota'), { status: 429 }));
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const id = (await upload(alice)).body.reviewer._id;
        await settleGenerationJobs();
        expect(generateJson).toHaveBeenCalledTimes(3);
        const status = await alice.get(`/api/reviewers/${id}/status`);
        expect(status.body).toMatchObject({ status: 'failed' });
        expect(status.body.error).toMatch(/busy/);
    });

    test('does not retry a bad request', async () => {
        generateJson.mockRejectedValue(Object.assign(new Error('bad'), { status: 400 }));
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        await upload(alice);
        await settleGenerationJobs();
        expect(generateJson).toHaveBeenCalledTimes(1);
    });

    test('recovers when a retry gives usable output', async () => {
        generateJson
            .mockResolvedValueOnce({ data: { ...aiOutput(), questions: [] }, model: 'gemini-test' })
            .mockResolvedValueOnce({ data: aiOutput(), model: 'gemini-test' });
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const id = (await upload(alice)).body.reviewer._id;
        await settleGenerationJobs();
        expect((await alice.get(`/api/reviewers/${id}/status`)).body.status).toBe('ready');
    });

    test('a failed reviewer can be retried from the stored text', async () => {
        generateJson.mockRejectedValue(Object.assign(new Error('down'), { status: 503 }));
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const id = (await upload(alice)).body.reviewer._id;
        await settleGenerationJobs();
        generateJson.mockResolvedValue({ data: aiOutput(), model: 'gemini-test' });
        const retry = await alice.post(`/api/reviewers/${id}/regenerate`).send({});
        expect(retry.body.reviewer.status).toBe('processing');
        await settleGenerationJobs();
        expect((await alice.get(`/api/reviewers/${id}`)).body.reviewer).toMatchObject({ status: 'ready', error: '', version: 1 });
    });

    test('a reviewer stuck processing (server restarted) is marked failed', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const user = await userModel.findOne({ email: 'alice@student.fatima.edu.ph' });
        const stuck = await reviewerModel.create({
            owner: user._id, title: 'Stuck', status: 'processing', jobId: 'gone', requestedAt: new Date(Date.now() - STALE_AFTER_MS - 1000),
        });
        const list = await alice.get('/api/reviewers');
        expect(list.body.reviewers[0]).toMatchObject({ _id: String(stuck._id), status: 'failed' });
        expect(list.body.reviewers[0].error).toMatch(/too long/);
    });
});

describe('who can see a reviewer', () => {
    test('only the owner', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
        const id = await makeReady(alice);
        expect((await bob.get(`/api/reviewers/${id}`)).status).toBe(404);
        expect((await bob.patch(`/api/reviewers/${id}`).send({ title: 'Mine now' })).status).toBe(404);
        expect((await bob.post(`/api/reviewers/${id}/sessions`).send({})).status).toBe(404);
        expect((await bob.delete(`/api/reviewers/${id}`)).status).toBe(404);
        expect((await bob.get('/api/reviewers')).body.reviewers).toEqual([]);
        expect((await alice.get('/api/reviewers/not-an-id')).status).toBe(404);
    });

    test('rename, then delete removes its sessions too', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const id = await makeReady(alice);
        const renamed = await alice.patch(`/api/reviewers/${id}`).send({ title: 'Bio midterm', course: 'BIO 101' });
        expect(renamed.body.reviewer).toMatchObject({ title: 'Bio midterm', course: 'BIO 101' });
        expect((await alice.patch(`/api/reviewers/${id}`).send({ title: '  ' })).status).toBe(400);
        await alice.post(`/api/reviewers/${id}/sessions`).send({});
        expect(await reviewerAttemptModel.countDocuments()).toBe(1);
        expect((await alice.delete(`/api/reviewers/${id}`)).body.success).toBe(true);
        expect(await reviewerModel.countDocuments()).toBe(0);
        expect(await reviewerAttemptModel.countDocuments()).toBe(0);
    });
});

describe('Learning Mode', () => {
    test('serves questions without answers, grades on the server, and scores per topic', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const id = await makeReady(alice);
        const key = await answerKey(id);

        const started = await alice.post(`/api/reviewers/${id}/sessions`).send({});
        expect(started.status).toBe(201);
        const { session } = started.body;
        expect(session.questions).toHaveLength(6);
        expect(JSON.stringify(session.questions)).not.toMatch(/correctIndex|explanation/);

        // Right on every Photosynthesis question, wrong on every Respiration one.
        for (const q of session.questions) {
            const correctIndex = key.get(q._id).correctIndex;
            const choice = q.topic === 'Photosynthesis' ? correctIndex : (correctIndex + 1) % 4;
            const res = await alice.post(`/api/reviewers/${id}/sessions/${session._id}/answer`).send({ questionId: q._id, choice });
            expect(res.body.result).toMatchObject({ correct: q.topic === 'Photosynthesis', correctIndex });
            expect(res.body.result.explanation).toMatch(/^Because/);
        }

        const done = await alice.post(`/api/reviewers/${id}/sessions/${session._id}/finish`).send({});
        expect(done.body.session).toMatchObject({ correct: 3, answered: 6, total: 6, score: 50, mode: 'all' });
        expect(done.body.review).toHaveLength(6);
        expect(done.body.progress.weakTopics).toEqual(['Respiration']);
        expect(done.body.progress.topics.find((t) => t.name === 'Photosynthesis').level).toBe('strong');

        const list = await alice.get('/api/reviewers');
        expect(list.body.reviewers[0]).toMatchObject({ lastScore: 50, sessions: 1 });

        const progress = await alice.get(`/api/reviewers/${id}/progress`);
        expect(progress.body.history).toHaveLength(1);
        expect(progress.body.progress.weakTopics).toEqual(['Respiration']);

        // Practising weak topics only serves those questions.
        const weak = await alice.post(`/api/reviewers/${id}/sessions`).send({ mode: 'weak' });
        expect(weak.body.session.mode).toBe('weak');
        expect(weak.body.session.questions.map((q) => q.topic)).toEqual(['Respiration', 'Respiration', 'Respiration']);
    });

    test('the first answer counts, and bad answers are refused', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const id = await makeReady(alice);
        const key = await answerKey(id);
        const { session } = (await alice.post(`/api/reviewers/${id}/sessions`).send({})).body;
        const base = `/api/reviewers/${id}/sessions/${session._id}`;
        const q = session.questions[0];
        const right = key.get(q._id).correctIndex;

        const first = await alice.post(`${base}/answer`).send({ questionId: q._id, choice: (right + 1) % 4 });
        expect(first.body.result.correct).toBe(false);
        const again = await alice.post(`${base}/answer`).send({ questionId: q._id, choice: right });
        expect(again.body.result).toMatchObject({ correct: false, choice: (right + 1) % 4 });
        expect(again.body.answered).toBe(1);

        expect((await alice.post(`${base}/answer`).send({ questionId: q._id, choice: 4 })).status).toBe(400);
        expect((await alice.post(`${base}/answer`).send({ questionId: session.questions[1]._id, choice: '1' })).status).toBe(400);
        expect((await alice.post(`${base}/answer`).send({ questionId: String(session._id), choice: 1 })).status).toBe(400);
    });

    test('a session can be resumed, finished early, and is closed after', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const id = await makeReady(alice);
        const { session } = (await alice.post(`/api/reviewers/${id}/sessions`).send({})).body;
        const base = `/api/reviewers/${id}/sessions/${session._id}`;
        await alice.post(`${base}/answer`).send({ questionId: session.questions[0]._id, choice: 0 });
        await alice.post(`${base}/answer`).send({ questionId: session.questions[1]._id, choice: 0 });

        const reviewer = await alice.get(`/api/reviewers/${id}`);
        expect(reviewer.body.openSession).toMatchObject({ _id: session._id, answered: 2, total: 6 });
        const resumed = await alice.get(base);
        expect(resumed.body.session.questions.map((q) => q._id)).toEqual(session.questions.map((q) => q._id));
        expect(resumed.body.session.answers).toHaveLength(2);
        expect(resumed.body.session.answers[0]).toHaveProperty('correctIndex');

        const done = await alice.post(`${base}/finish`).send({});
        expect(done.body.session).toMatchObject({ answered: 2, total: 6 });
        expect((await alice.post(`${base}/answer`).send({ questionId: session.questions[2]._id, choice: 0 })).status).toBe(409);
        // Finishing twice gives the same result.
        expect((await alice.post(`${base}/finish`).send({})).body.session.answered).toBe(2);
        expect((await alice.get(`/api/reviewers/${id}`)).body.openSession).toBeNull();
    });

    test('a session with no answers is dropped', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const id = await makeReady(alice);
        const { session } = (await alice.post(`/api/reviewers/${id}/sessions`).send({})).body;
        const done = await alice.post(`/api/reviewers/${id}/sessions/${session._id}/finish`).send({});
        expect(done.body.session).toBeNull();
        expect(await reviewerAttemptModel.countDocuments()).toBe(0);
    });

    test('weak-topic practice needs weak topics first', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const id = await makeReady(alice);
        const res = await alice.post(`/api/reviewers/${id}/sessions`).send({ mode: 'weak' });
        expect(res.status).toBe(400);
    });

    test('new questions start a fresh question set and close old sessions', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const id = await makeReady(alice);
        const { session } = (await alice.post(`/api/reviewers/${id}/sessions`).send({})).body;
        await alice.post(`/api/reviewers/${id}/sessions/${session._id}/answer`).send({ questionId: session.questions[0]._id, choice: 0 });
        await alice.post(`/api/reviewers/${id}/sessions/${session._id}/finish`).send({});
        const { session: open } = (await alice.post(`/api/reviewers/${id}/sessions`).send({})).body;

        // Hold the AI answer so the second request lands while the first is still running.
        let release;
        generateJson.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ data: aiOutput(), model: 'gemini-test' }); }));
        const regen = await alice.post(`/api/reviewers/${id}/regenerate`).send({ questionCount: 20 });
        expect(regen.body.reviewer).toMatchObject({ status: 'processing', questionTarget: 20 });
        expect((await alice.post(`/api/reviewers/${id}/regenerate`).send({})).status).toBe(409);
        await vi.waitFor(() => expect(release).toBeTypeOf('function'));
        release();
        await settleGenerationJobs();

        const after = await alice.get(`/api/reviewers/${id}`);
        expect(after.body.reviewer.version).toBe(2);
        expect(after.body.openSession).toBeNull();
        expect((await alice.post(`/api/reviewers/${id}/sessions/${open._id}/answer`).send({ questionId: open.questions[0]._id, choice: 0 })).status).toBe(409);
        const progress = await alice.get(`/api/reviewers/${id}/progress`);
        expect(progress.body.progress.sessions).toBe(0);
        expect(progress.body.history).toHaveLength(1);
        expect((await alice.get('/api/reviewers')).body.reviewers[0]).toMatchObject({ lastScore: null, sessions: 0 });
    });

    test('a reviewer that is not ready cannot start a session', async () => {
        generateJson.mockRejectedValue(Object.assign(new Error('bad'), { status: 400 }));
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const id = (await upload(alice)).body.reviewer._id;
        await settleGenerationJobs();
        expect((await alice.post(`/api/reviewers/${id}/sessions`).send({})).status).toBe(409);
    });
});
