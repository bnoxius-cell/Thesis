import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import request from 'supertest';
import app from '../app.js';
import reviewerModel from '../models/reviewerModel.js';
import reviewerAttemptModel from '../models/reviewerAttemptModel.js';
import { geminiSettings } from '../utils/gemini.js';
import { generationSettings, settleGenerationJobs } from '../controllers/reviewerController.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';
import { startFakeGemini, GEMINI_ERRORS } from './helpers/fakeGemini.js';

// The whole workflow with nothing mocked but Gemini's servers: a real PDF goes through upload,
// validation, text extraction and cleaning, then the real utils/gemini.js and @google/genai SDK
// send it over HTTP to a fake Gemini on localhost, and the answer is checked, stored, studied
// in Learning Mode, scored, and turned into weak topics and targeted questions. The fake server
// counts every request, so this also shows exactly which actions use the AI.

vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
}));

const HANDOUT = readFileSync(new URL('./fixtures/stress-handout.pdf', import.meta.url));

const q = (topic, prompt, options, explanation, difficulty = 'medium') => ({ topic, prompt, options, correctIndex: 0, explanation, difficulty });
// What a good Gemini answer for the handout looks like. The right option is written first.
const REVIEWER = {
    title: 'Stress and Coping Basics',
    summary: 'How stress works in the body and mind, and the main ways to cope with it.',
    topics: [
        { name: 'Stress and appraisal', summary: 'Eustress, distress and how appraisal shapes stress.' },
        { name: 'The stress response', summary: 'Fight-or-flight, the HPA axis and cortisol.' },
        { name: 'Coping strategies', summary: 'Problem-focused and emotion-focused coping.' },
    ],
    keyPoints: ['Appraisal decides whether a situation is stressful.', 'Cortisol stays high during long stress.'],
    keyTerms: [{ term: 'Eustress', definition: 'Positive stress that motivates.' }],
    questions: [
        q('Stress and appraisal', 'What is eustress?', ['Positive stress that motivates', 'Stress that causes illness', 'A stress hormone', 'A coping style'], 'Eustress is positive stress.', 'easy'),
        q('Stress and appraisal', 'What happens in secondary appraisal?', ['Judging if you can cope', 'Judging if a situation is stressful', 'Releasing cortisol', 'Seeking support'], 'Secondary appraisal is about resources.'),
        q('Stress and appraisal', 'Who proposed the transactional model?', ['Lazarus and Folkman', 'Hans Selye', 'Cohen and Kamarck', 'Freud'], 'Lazarus and Folkman, 1984.', 'easy'),
        q('The stress response', 'Which gland releases ACTH?', ['Pituitary', 'Adrenal cortex', 'Hypothalamus', 'Thyroid'], 'The pituitary releases ACTH.'),
        q('The stress response', 'What does the adrenal cortex release?', ['Cortisol', 'Adrenaline', 'CRH', 'Insulin'], 'The adrenal cortex releases cortisol.'),
        q('The stress response', 'What is the last stage of the General Adaptation Syndrome?', ['Exhaustion', 'Alarm', 'Resistance', 'Recovery'], 'Exhaustion comes last.', 'hard'),
        q('Coping strategies', 'Making a study schedule is an example of what?', ['Problem-focused coping', 'Emotion-focused coping', 'Avoidance', 'Eustress'], 'It changes the situation itself.'),
        q('Coping strategies', 'When does emotion-focused coping work best?', ['When the stressor cannot be changed', 'When the stressor can be controlled', 'Never', 'Only at night'], 'It fits stressors you cannot change.', 'hard'),
        q('Coping strategies', 'What does kapwa refer to?', ['Shared identity', 'Fate', 'A stress hormone', 'A test'], 'Kapwa is a shared identity.', 'easy'),
        q('Coping strategies', 'Which is emotion-focused coping?', ['Deep breathing', 'Splitting a project into tasks', 'Asking a teacher for help', 'Making a schedule'], 'Deep breathing changes how you feel.'),
    ],
};
const TARGETED = {
    questions: [
        q('The stress response', 'What does the hypothalamus release first in the HPA axis?', ['CRH', 'ACTH', 'Cortisol', 'Adrenaline'], 'The hypothalamus starts with CRH.'),
        q('The stress response', 'Which part of the adrenal gland releases adrenaline?', ['Adrenal medulla', 'Adrenal cortex', 'Pituitary', 'Thalamus'], 'The medulla releases adrenaline.'),
        q('The stress response', 'What can cortisol that stays high for weeks do?', ['Weaken the immune system', 'Cure insomnia', 'Lower blood sugar', 'Stop the heart'], 'Long high cortisol weakens immunity.', 'hard'),
        q('The stress response', 'Which system starts fight-or-flight?', ['Sympathetic nervous system', 'Parasympathetic nervous system', 'Digestive system', 'Lymphatic system'], 'The sympathetic system triggers it.', 'easy'),
        q('The stress response', 'Which stage of the GAS comes first?', ['Alarm', 'Resistance', 'Exhaustion', 'Adaptation'], 'Alarm is the first stage.', 'easy'),
    ],
};
const isTargetedPrompt = (prompt) => prompt.includes('new multiple-choice questions on these topics only');

let gemini;
const saved = {};
const KEYS = ['GEMINI_API_KEY', 'GEMINI_MODEL', 'GOOGLE_GEMINI_BASE_URL'];

beforeAll(async () => {
    gemini = await startFakeGemini();
    for (const k of KEYS) saved[k] = process.env[k];
    process.env.GOOGLE_GEMINI_BASE_URL = gemini.url;
    generationSettings.retryDelaysMs = [0, 0, 0];
    await connectTestDB();
});
afterAll(async () => {
    for (const k of KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
    }
    await gemini.close();
    await closeTestDB();
});
beforeEach(async () => {
    await clearTestDB();
    gemini.reset();
    gemini.reply(({ prompt }) => ({ json: isTargetedPrompt(prompt) ? TARGETED : REVIEWER }));
    process.env.GEMINI_API_KEY = 'test-key';
    delete process.env.GEMINI_MODEL;
    geminiSettings.timeoutMs = 100000;
});

const signUp = async (email = 'alice@student.fatima.edu.ph') => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email, name: 'Alice' }));
    return agent;
};
const upload = (agent, fields = {}) => {
    let req = agent.post('/api/reviewers');
    for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
    return req.attach('pdf', HANDOUT, { filename: 'PSY101_Module_4.pdf', contentType: 'application/pdf' });
};
const quietly = async (fn) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try { return await fn(); } finally { log.mockRestore(); }
};

describe('the complete workflow', () => {
    test('PDF to reviewer to Learning Mode to weak topics to targeted review', async () => {
        const alice = await signUp();

        // Upload: the request answers at once, the AI works in the background.
        const created = await upload(alice, { course: 'PSY 101', questionCount: '10' });
        expect(created.status).toBe(201);
        expect(created.body.reviewer).toMatchObject({ status: 'processing', title: 'PSY101 Module 4', course: 'PSY 101' });
        expect(created.body.reviewer.source).toMatchObject({ pages: 3, truncated: false });
        const id = created.body.reviewer._id;
        await settleGenerationJobs();

        // Exactly one request, carrying the handout's text inside the delimiters, never the key in the URL.
        expect(gemini.requests).toHaveLength(1);
        const [sent] = gemini.requests;
        expect(sent.apiKey).toBe('test-key');
        expect(sent.url).not.toContain('test-key');
        expect(sent.prompt).toContain('exactly 10 multiple-choice questions');
        expect(sent.prompt).toMatch(/<study_material>\nPSY 101 – Stress and Coping[\s\S]+3\. General Adaptation Syndrome[\s\S]+27–40[\s\S]+<\/study_material>$/);
        expect(sent.body.generationConfig.responseMimeType).toBe('application/json');

        // Stored for this student, with the AI's title replacing the file name.
        const stored = await reviewerModel.findById(id);
        expect(stored).toMatchObject({ status: 'ready', version: 1, title: 'Stress and Coping Basics', aiModel: 'gemini-fake-001' });
        expect(stored.questions).toHaveLength(10);
        for (const question of stored.questions) {
            const original = REVIEWER.questions.find((o) => o.prompt === question.prompt);
            expect(question.options[question.correctIndex]).toBe(original.options[0]);
            expect(question.explanation).toBe(original.explanation);
            expect(question.difficulty).toBe(original.difficulty);
        }

        // Displayed without the answer key.
        const shown = (await alice.get(`/api/reviewers/${id}`)).body.reviewer;
        expect(shown).toMatchObject({ status: 'ready', questionCount: 10, summary: REVIEWER.summary });
        expect(shown.topics.map((t) => t.name)).toEqual(REVIEWER.topics.map((t) => t.name));
        expect(JSON.stringify(shown)).not.toMatch(/correctIndex|explanation/);

        // Learning Mode: right on everything except "The stress response".
        const session = (await alice.post(`/api/reviewers/${id}/sessions`).send({})).body.session;
        const key = new Map(stored.questions.map((x) => [String(x._id), x.correctIndex]));
        for (const question of session.questions) {
            const right = key.get(question._id);
            const choice = question.topic === 'The stress response' ? (right + 1) % 4 : right;
            const res = await alice.post(`/api/reviewers/${id}/sessions/${session._id}/answer`).send({ questionId: question._id, choice });
            expect(res.body.result.correct).toBe(choice === right);
            expect(res.body.result.explanation.length).toBeGreaterThan(0);
        }
        const done = (await alice.post(`/api/reviewers/${id}/sessions/${session._id}/finish`).send({})).body;
        expect(done.session).toMatchObject({ correct: 7, answered: 10, total: 10, score: 70 });
        expect(done.progress.weakTopics).toEqual(['The stress response']);

        // None of that called the AI. Reopening the reviewer later doesn't either.
        await alice.get(`/api/reviewers/${id}`);
        await alice.get(`/api/reviewers/${id}/progress`);
        await alice.get('/api/reviewers');
        expect(gemini.requests).toHaveLength(1);

        // Targeted review on the weak topic: one more request, about that topic, from the same text.
        expect((await alice.post(`/api/reviewers/${id}/targeted`).send({ topics: done.progress.weakTopics, questionCount: 5 })).status).toBe(202);
        await settleGenerationJobs();
        expect(gemini.requests).toHaveLength(2);
        const targeted = gemini.requests[1].prompt;
        expect(targeted).toContain('wants more practice on these topics: "The stress response"');
        expect(targeted).toContain('exactly 5 new multiple-choice questions');
        expect(targeted).toContain('- Which gland releases ACTH?'); // told what the student already has
        expect(targeted).not.toContain('- What is eustress?'); // other topics aren't listed
        expect(targeted).toContain('The hypothalamus releases CRH'); // the original document

        const after = await reviewerModel.findById(id);
        expect(after.questions).toHaveLength(15);
        const added = after.questions.filter((x) => x.batch);
        expect(added).toHaveLength(5);
        expect(new Set(added.map((x) => x.topic))).toEqual(new Set(['The stress response']));
        expect(after.version).toBe(1);

        const practice = (await alice.post(`/api/reviewers/${id}/sessions`).send({ mode: 'targeted' })).body.session;
        expect(practice.questions.map((x) => x.prompt).sort()).toEqual(TARGETED.questions.map((x) => x.prompt).sort());
        expect(await reviewerAttemptModel.countDocuments()).toBe(2);
        expect(gemini.requests).toHaveLength(2);
    });
});

describe('when Gemini misbehaves', () => {
    test('an invalid key: one request, a plain message, nothing to practise', async () => {
        process.env.GEMINI_API_KEY = 'not-a-real-key';
        gemini.reply(() => ({ error: GEMINI_ERRORS.badKey }));
        const alice = await signUp();
        const id = (await upload(alice)).body.reviewer._id;
        await quietly(settleGenerationJobs);
        expect(gemini.requests).toHaveLength(1);
        expect(gemini.requests[0].apiKey).toBe('not-a-real-key');
        const status = (await alice.get(`/api/reviewers/${id}/status`)).body;
        expect(status).toMatchObject({ status: 'failed', error: "Reviewers aren't working on our side right now. Try again later." });
    });

    test('busy twice, then fine: the student never notices', async () => {
        gemini.reply((_, n) => (n <= 2 ? { error: GEMINI_ERRORS.busy } : { json: REVIEWER }));
        const alice = await signUp();
        const id = (await upload(alice)).body.reviewer._id;
        await settleGenerationJobs();
        expect(gemini.requests).toHaveLength(3);
        expect((await alice.get(`/api/reviewers/${id}/status`)).body.status).toBe('ready');
    });

    test('a cut-off answer, then a good one', async () => {
        gemini.reply((_, n) => (n === 1 ? { text: '{"title": "Stress', finishReason: 'MAX_TOKENS' } : { json: REVIEWER }));
        const alice = await signUp();
        const id = (await upload(alice)).body.reviewer._id;
        await settleGenerationJobs();
        expect(gemini.requests).toHaveLength(2);
        expect((await alice.get(`/api/reviewers/${id}/status`)).body.status).toBe('ready');
    });

    test('no answer in time, every time', async () => {
        geminiSettings.timeoutMs = 200;
        gemini.reply(() => ({ delayMs: 1500, json: REVIEWER }));
        const alice = await signUp();
        const id = (await upload(alice)).body.reviewer._id;
        await quietly(settleGenerationJobs);
        expect(gemini.requests).toHaveLength(4);
        const status = (await alice.get(`/api/reviewers/${id}/status`)).body;
        expect(status).toMatchObject({ status: 'failed' });
        expect(status.error).toMatch(/took too long/);
    });

    test('an answer with every question broken', async () => {
        gemini.reply(() => ({ json: { ...REVIEWER, questions: REVIEWER.questions.map((x) => ({ ...x, options: x.options.slice(0, 2) })) } }));
        const alice = await signUp();
        const id = (await upload(alice)).body.reviewer._id;
        await quietly(settleGenerationJobs);
        expect(gemini.requests).toHaveLength(4);
        const stored = await reviewerModel.findById(id);
        expect(stored).toMatchObject({ status: 'failed', version: 0 });
        expect(stored.questions).toHaveLength(0);
    });
});
