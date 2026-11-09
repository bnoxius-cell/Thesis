import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';
import groupMessageModel from '../models/groupMessageModel.js';
import reviewerModel from '../models/reviewerModel.js';
import notificationModel from '../models/notificationModel.js';
import { reviewerSnapshot, reviewerTexts } from '../utils/reviewerShare.js';

vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
}));
// Configured, so regenerate and targeted get as far as their own checks. Nothing here generates.
vi.mock('../utils/gemini.js', () => ({
    generateJson: vi.fn(),
    isGeminiConfigured: vi.fn(() => true),
}));

beforeAll(connectTestDB);
beforeEach(clearTestDB);
afterAll(closeTestDB);

const SECRET_NOTES = 'Alice private lecture notes about routing';
const SECRET_FILE = 'alice-secret-notes.pdf';

const signUp = async (email, name) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email, name }));
    const me = await agent.get('/api/user/data');
    agent.id = me.body.userData._id;
    return agent;
};

// alice owns the group, bob and dave are members, carol is an outsider.
const setup = async () => {
    const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
    const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
    const carol = await signUp('carol@student.fatima.edu.ph', 'Carol');
    const dave = await signUp('dave@student.fatima.edu.ph', 'Dave');
    const group = (await alice.post('/api/groups').send({ name: 'Study Squad' })).body.group;
    await bob.post('/api/groups/join').send({ joinCode: group.joinCode });
    await dave.post('/api/groups/join').send({ joinCode: group.joinCode });
    return { alice, bob, carol, dave, group };
};

const question = (topic, i, overrides = {}) => ({
    topic,
    prompt: `${topic} question ${i}?`,
    options: ['right', 'wrong one', 'wrong two', 'wrong three'],
    correctIndex: 2,
    explanation: `Because of ${topic} ${i}.`,
    difficulty: 'hard',
    batch: '',
    ...overrides,
});

const makeReviewer = (owner, overrides = {}) => reviewerModel.create({
    owner: owner.id,
    title: 'Networks ch. 3',
    course: 'IT 301',
    source: { type: 'pdf', fileName: SECRET_FILE, pages: 12, chars: 5000, truncated: false, fingerprint: 'abc' },
    sources: [{ type: 'pdf', fileName: SECRET_FILE, pages: 12, chars: 5000 }],
    sourceText: SECRET_NOTES,
    status: 'ready',
    version: 3,
    summary: 'How packets find their way.',
    keyPoints: ['Routers forward packets.'],
    keyTerms: [{ term: 'Hop', definition: 'One router on the way.' }],
    topics: [{ name: 'Routing', summary: 'Picking a path.', parts: [1] }, { name: 'Switching', summary: 'Inside a LAN.', parts: [2] }],
    questions: [question('Routing', 1), question('Routing', 2), question('Switching', 1, { batch: 'b1' })],
    ...overrides,
});

const share = (agent, group, reviewer) => agent.post(`/api/groups/${group._id}/messages`).send({ reviewerId: String(reviewer._id) });
const save = (agent, group, messageId) => agent.post(`/api/groups/${group._id}/messages/${messageId}/save`);
const messagesOf = async (agent, group) => (await agent.get(`/api/groups/${group._id}/messages`)).body.messages;

// Nothing that would give away an answer, or the sender's notes and file names.
const expectNoAnswers = (body) => {
    const json = JSON.stringify(body);
    ['correctIndex', 'explanation', 'reviewerContent', 'sourceText', SECRET_NOTES, SECRET_FILE, 'Because of'].forEach((leak) => {
        expect(json, leak).not.toContain(leak);
    });
};

describe('sharing a reviewer', () => {
    test('posts a preview card and keeps the answers out of every message list', async () => {
        const { alice, bob, group } = await setup();
        const reviewer = await makeReviewer(alice);

        const sent = await share(alice, group, reviewer);
        expect(sent.status).toBe(200);
        expectNoAnswers(sent.body);
        expect(sent.body.message).toMatchObject({
            type: 'reviewer',
            addedByMe: false,
            reviewer: { title: 'Networks ch. 3', course: 'IT 301', questionCount: 3, topicNames: ['Routing', 'Switching'], summary: 'How packets find their way.' },
        });
        const messageId = sent.body.message._id;

        const list = await bob.get(`/api/groups/${group._id}/messages`);
        expectNoAnswers(list.body);
        expect(list.body.messages).toHaveLength(1);

        // The poll and its change feed, after a reaction bumps the message.
        const since = new Date(Date.now() - 1000).toISOString();
        await bob.put(`/api/groups/${group._id}/messages/${messageId}/reactions`).send({ emoji: '\u{1F44D}', on: true });
        const poll = await bob.get(`/api/groups/${group._id}/messages?after=${messageId}&since=${since}`);
        expect(poll.body.changes).toHaveLength(1);
        expectNoAnswers(poll.body);

        expectNoAnswers((await bob.get(`/api/groups/${group._id}/upcoming`)).body);

        // The answers are stored, just never sent.
        const stored = await groupMessageModel.findById(messageId).select('+reviewerContent').lean();
        expect(stored.reviewerContent.questions).toHaveLength(3);
        expect(stored.reviewerContent.questions[0]).toMatchObject({ correctIndex: 2, explanation: 'Because of Routing 1.' });
        expect(stored.reviewerContent.questions[0]._id).toBeUndefined();
        expect(JSON.stringify(stored)).not.toContain(SECRET_NOTES);
        expect(JSON.stringify(stored)).not.toContain(SECRET_FILE);
    });

    test('only the owner can share, and only a ready reviewer with no extra questions on the way', async () => {
        const { alice, bob, group } = await setup();
        const bobs = await makeReviewer(bob);
        expect((await share(alice, group, bobs)).status).toBe(404);
        expect((await alice.post(`/api/groups/${group._id}/messages`).send({ reviewerId: 'nope' })).status).toBe(404);

        const processing = await makeReviewer(alice, { status: 'processing', questions: [] });
        expect((await share(alice, group, processing)).status).toBe(409);

        const extending = await makeReviewer(alice, { targeted: { status: 'processing', topics: ['Routing'], count: 5 } });
        expect((await share(alice, group, extending)).status).toBe(409);

        expect(await groupMessageModel.countDocuments()).toBe(0);
    });

    test('an outsider gets 404 for sharing into the group', async () => {
        const { carol, group } = await setup();
        const carols = await makeReviewer(carol);
        expect((await share(carol, group, carols)).status).toBe(404);
    });

    test('a family-friendly group checks every part of the reviewer, explanations included', async () => {
        const { alice, group } = await setup();
        await alice.patch(`/api/groups/${group._id}`).send({ familyFriendly: true });
        const rude = await makeReviewer(alice, {
            questions: [question('Routing', 1), question('Routing', 2, { explanation: 'This is bullshit.' })],
        });

        const res = await share(alice, group, rude);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('family_filter');
        expect(await groupMessageModel.countDocuments()).toBe(0);

        const clean = await makeReviewer(alice);
        expect((await share(alice, group, clean)).status).toBe(200);
    });
});

describe('saving a shared reviewer', () => {
    test('gives the groupmate a ready copy of their own, without the sender\'s notes', async () => {
        const { alice, bob, dave, group } = await setup();
        await bob.post('/api/subjects').send({ name: 'Computer Networks', code: 'IT-301' });
        const original = await makeReviewer(alice);
        const messageId = (await share(alice, group, original)).body.message._id;

        const res = await save(bob, group, messageId);
        expect(res.status).toBe(201);
        expect(res.body.saved).toMatchObject({ type: 'reviewer', title: 'Networks ch. 3' });

        const copy = await reviewerModel.findById(res.body.saved._id).select('+sourceText').lean();
        expect(String(copy.owner)).toBe(bob.id);
        expect(copy).toMatchObject({
            status: 'ready',
            version: 1,
            autoTitle: false,
            sourceText: '',
            sources: [],
            copiedFrom: `message:${messageId}`,
            course: 'IT-301',
            summary: 'How packets find their way.',
            keyPoints: ['Routers forward packets.'],
            keyTerms: [{ term: 'Hop', definition: 'One router on the way.' }],
            topics: [{ name: 'Routing', summary: 'Picking a path.' }, { name: 'Switching', summary: 'Inside a LAN.' }],
            targeted: { status: 'none' },
        });
        expect(copy.subject).not.toBeNull();
        expect(copy.source).toMatchObject({ type: 'pdf', fileName: '', pages: 12, chars: 5000, truncated: false, fingerprint: '' });
        expect(copy.generatedAt).toBeInstanceOf(Date);
        expect(copy.questions).toHaveLength(3);
        expect(copy.questions.every((q) => q.batch === '')).toBe(true);
        expect(copy.questions[0]).toMatchObject({ topic: 'Routing', correctIndex: 2, difficulty: 'hard', explanation: 'Because of Routing 1.' });
        const originalIds = new Set(original.questions.map((q) => String(q._id)));
        expect(copy.questions.some((q) => originalIds.has(String(q._id)))).toBe(false);

        // Bob can study it, but can't make new questions from notes he never had.
        const session = await bob.post(`/api/reviewers/${copy._id}/sessions`).send({});
        expect(session.status).toBe(201);
        expect(session.body.session.total).toBe(3);
        const regenerate = await bob.post(`/api/reviewers/${copy._id}/regenerate`).send({});
        expect(regenerate.status).toBe(409);
        expect(regenerate.body.message).toBe('Add the files again to make new questions.');

        // The card now reads as added for Bob only.
        expect((await messagesOf(bob, group))[0].addedByMe).toBe(true);
        expect((await messagesOf(dave, group))[0].addedByMe).toBe(false);
    });

    test('keeps the course as typed when the groupmate has no matching subject', async () => {
        const { alice, bob, group } = await setup();
        const messageId = (await share(alice, group, await makeReviewer(alice))).body.message._id;
        const { saved } = (await save(bob, group, messageId)).body;
        const copy = await reviewerModel.findById(saved._id).lean();
        expect(copy).toMatchObject({ course: 'IT 301', subject: null });
    });

    test('a second save answers 409 with alreadyAdded', async () => {
        const { alice, bob, group } = await setup();
        const messageId = (await share(alice, group, await makeReviewer(alice))).body.message._id;
        expect((await save(bob, group, messageId)).status).toBe(201);

        const again = await save(bob, group, messageId);
        expect(again.status).toBe(409);
        expect(again.body.alreadyAdded).toBe(true);
        expect(await reviewerModel.countDocuments({ owner: bob.id })).toBe(1);
    });

    test('two saves at the same moment make one copy', async () => {
        const { alice, bob, group } = await setup();
        await reviewerModel.init();
        const messageId = (await share(alice, group, await makeReviewer(alice))).body.message._id;
        const statuses = (await Promise.all([save(bob, group, messageId), save(bob, group, messageId)])).map((r) => r.status);
        expect(statuses.sort()).toEqual([201, 409]);
        expect(await reviewerModel.countDocuments({ owner: bob.id })).toBe(1);
    });

    test('outsiders, bad ids, other groups\' messages and deleted messages answer 404', async () => {
        const { alice, bob, carol, group } = await setup();
        const messageId = (await share(alice, group, await makeReviewer(alice))).body.message._id;

        expect((await save(carol, group, messageId)).status).toBe(404);
        expect((await save(bob, group, 'not-an-id')).status).toBe(404);
        expect((await save(bob, { _id: '507f1f77bcf86cd799439011' }, messageId)).status).toBe(404);

        const other = (await bob.post('/api/groups').send({ name: 'Other' })).body.group;
        expect((await save(bob, other, messageId)).status).toBe(404);

        await alice.delete(`/api/groups/${group._id}/messages/${messageId}`);
        expect((await save(bob, group, messageId)).status).toBe(404);
        expect(await reviewerModel.countDocuments({ owner: bob.id })).toBe(0);
    });

    test('a plain message can\'t be saved', async () => {
        const { alice, bob, group } = await setup();
        const text = (await alice.post(`/api/groups/${group._id}/messages`).send({ text: 'hi' })).body.message;
        expect((await save(bob, group, text._id)).status).toBe(400);
    });

    test('the share outlives the original: deleting it keeps Bob\'s copy and Dave can still save', async () => {
        const { alice, bob, dave, group } = await setup();
        const original = await makeReviewer(alice);
        const messageId = (await share(alice, group, original)).body.message._id;
        const bobsCopy = (await save(bob, group, messageId)).body.saved;

        expect((await alice.delete(`/api/reviewers/${original._id}`)).status).toBe(200);

        expect((await bob.post(`/api/reviewers/${bobsCopy._id}/sessions`).send({})).status).toBe(201);
        const davesSave = await save(dave, group, messageId);
        expect(davesSave.status).toBe(201);
        expect((await dave.post(`/api/reviewers/${davesSave.body.saved._id}/sessions`).send({})).status).toBe(201);
    });

    test('deleting the message drops the stored answers with it', async () => {
        const { alice, group } = await setup();
        const messageId = (await share(alice, group, await makeReviewer(alice))).body.message._id;
        await alice.delete(`/api/groups/${group._id}/messages/${messageId}`);
        const stored = await groupMessageModel.findById(messageId).select('+reviewerContent').lean();
        expect(stored.type).toBe('deleted');
        expect(stored.reviewer).toBeUndefined();
        expect(stored.reviewerContent).toBeUndefined();
    });
});

describe('group_share notifications', () => {
    const sharesFor = (agent) => notificationModel.find({ recipient: agent.id, type: 'group_share' }).lean();

    test('tell the group who shared which reviewer, one notification per share', async () => {
        const { alice, bob, group } = await setup();
        await share(alice, group, await makeReviewer(alice));
        await share(alice, group, await makeReviewer(alice, { title: 'Subnetting' }));

        const notes = await sharesFor(bob);
        expect(notes.map((n) => n.message).sort()).toEqual(['Alice shared a reviewer: Networks ch. 3', 'Alice shared a reviewer: Subnetting']);
        expect(await sharesFor(alice)).toHaveLength(0);
    });

    test('follow the groupTasks switch and the "tasks only" override', async () => {
        const { alice, bob, dave, group } = await setup();
        await bob.put('/api/notifications/preferences').send({ groupTasks: false });
        await dave.put('/api/notifications/preferences').send({ groupOverrides: [{ group: group._id, level: 'tasks' }] });

        await share(alice, group, await makeReviewer(alice));
        expect(await sharesFor(bob)).toHaveLength(0);
        expect(await sharesFor(dave)).toHaveLength(1);
    });

    test('opening the chat marks them read and they count toward the group badge until then', async () => {
        const { alice, bob, group } = await setup();
        await share(alice, group, await makeReviewer(alice));
        expect((await sharesFor(bob))[0].isRead).toBe(false);
        expect((await bob.get('/api/notifications/summary')).body.groups).toEqual([{ group: group._id, count: 1 }]);

        await bob.get(`/api/groups/${group._id}/messages`);
        expect((await sharesFor(bob))[0].isRead).toBe(true);
        expect((await bob.get('/api/notifications/summary')).body.groups).toEqual([]);
    });
});

describe('reviewerSnapshot and reviewerTexts', () => {
    const plainReviewer = (overrides = {}) => ({
        title: 'T', course: 'C', summary: 'S'.repeat(400),
        source: { type: 'notes', count: 1, pages: 0, slides: 0, chars: 900, truncated: false },
        keyPoints: ['kp'], keyTerms: [{ term: 'term', definition: 'def' }],
        topics: Array.from({ length: 10 }, (_, i) => ({ name: `${'n'.repeat(90)}${i}`, summary: `ts${i}` })),
        questions: [{ topic: 'q-topic', prompt: 'prompt', options: ['o1', 'o2', 'o3', 'o4'], correctIndex: 1, explanation: 'why', difficulty: 'easy' }],
        ...overrides,
    });

    test('the card keeps at most 8 topic names and short text', () => {
        const { reviewer } = reviewerSnapshot(plainReviewer());
        expect(reviewer.topicNames).toHaveLength(8);
        expect(reviewer.topicNames.every((n) => n.length <= 80)).toBe(true);
        expect(reviewer.summary.length).toBeLessThanOrEqual(280);
        expect(reviewer.questionCount).toBe(1);
    });

    test('the filter sees every piece of text, all topics and full summary included', () => {
        const snapshot = reviewerSnapshot(plainReviewer());
        const texts = reviewerTexts(snapshot);
        ['T', 'C', 'S'.repeat(400), 'kp', 'term', 'def', 'ts9', `${'n'.repeat(90)}9`, 'prompt', 'o1', 'o4', 'why'].forEach((text) => {
            expect(texts, text).toContain(text);
        });
    });
});
