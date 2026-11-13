import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import userModel from '../models/userModel.js';
import reviewerModel from '../models/reviewerModel.js';
import aiRequestModel from '../models/aiRequestModel.js';
import flashcardDeckModel from '../models/flashcardDeckModel.js';
import flashcardModel from '../models/flashcardModel.js';
import { deleteUserData } from '../utils/userData.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';

vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(async () => {
    await connectTestDB();
    // The one-deck-per-reviewer rule is a unique index, so it has to exist before the race test.
    await flashcardDeckModel.init();
});
beforeEach(clearTestDB);
afterAll(closeTestDB);

const signUp = async (email) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email }));
    return { agent, id: (await userModel.findOne({ email }))._id };
};
const twoStudents = async () => ({
    maria: await signUp('maria@student.fatima.edu.ph'),
    jose: await signUp('jose@student.fatima.edu.ph'),
});

const DAY = 24 * 60 * 60 * 1000;
const makeDeck = (owner, extra = {}) => flashcardDeckModel.create({ owner, title: 'Networking', ...extra });
const makeCard = (owner, deck, extra = {}) => flashcardModel.create({ owner, deck, term: 'Firewall', answer: 'Filters traffic.', ...extra });
const makeCards = (owner, deck, count, extra = {}) => flashcardModel.insertMany(
    Array.from({ length: count }, (_, i) => ({ owner, deck, term: `Term ${i}`, answer: `Answer ${i}`, ...extra })),
);
const readyReviewer = (owner, keyTerms, extra = {}) => reviewerModel.create({
    owner, title: 'Network notes', course: 'IT 301', status: 'ready', keyTerms, ...extra,
});
const fromReviewer = (agent, reviewerId) => agent.post('/api/flashcards/decks/from-reviewer').send({ reviewerId });

describe('flashcards need a signed-in student', () => {
    test('every route refuses a visitor', async () => {
        expect((await request(app).get('/api/flashcards')).body.success).toBe(false);
        expect((await request(app).post('/api/flashcards/decks').send({ title: 'x' })).body.success).toBe(false);
    });
});

describe('decks', () => {
    test('creates one with and without a subject', async () => {
        const { maria } = await twoStudents();
        const plain = await maria.agent.post('/api/flashcards/decks').send({ title: '  Week   1  ' });
        expect(plain.status).toBe(201);
        expect(plain.body.deck).toMatchObject({
            title: 'Week 1', course: '', subject: null, reviewer: null, cards: 0, due: 0, status: 'new', nextDueDays: null,
        });

        const subject = (await maria.agent.post('/api/subjects').send({ name: 'Data Structures', code: 'IT 301' })).body.subject;
        const linked = await maria.agent.post('/api/flashcards/decks').send({ title: 'Trees', subject: subject._id });
        expect(linked.status).toBe(201);
        expect(linked.body.deck).toMatchObject({ subject: subject._id, course: 'IT 301' });
    });

    test('refuses a subject that is not theirs, a blank title and a title over 120 characters', async () => {
        const { maria, jose } = await twoStudents();
        const josesSubject = (await jose.agent.post('/api/subjects').send({ name: 'Physics' })).body.subject;
        const foreign = await maria.agent.post('/api/flashcards/decks').send({ title: 'x', subject: josesSubject._id });
        expect(foreign.status).toBe(400);
        expect(foreign.body.message).toBe('Pick one of your subjects.');
        expect((await maria.agent.post('/api/flashcards/decks').send({ title: '   ' })).status).toBe(400);
        expect((await maria.agent.post('/api/flashcards/decks').send({ title: 'a'.repeat(121) })).status).toBe(400);
        expect((await maria.agent.post('/api/flashcards/decks').send({ title: { $gt: '' } })).status).toBe(400);
        expect(await flashcardDeckModel.countDocuments()).toBe(0);
    });

    test('stops at 50 decks', async () => {
        const { maria } = await twoStudents();
        await flashcardDeckModel.insertMany(Array.from({ length: 50 }, (_, i) => ({ owner: maria.id, title: `Deck ${i}` })));
        const res = await maria.agent.post('/api/flashcards/decks').send({ title: 'One too many' });
        expect(res.status).toBe(400);
        expect(await flashcardDeckModel.countDocuments()).toBe(50);
    });

    test('renames a deck and moves it to another subject', async () => {
        const { maria } = await twoStudents();
        const deck = await makeDeck(maria.id);
        const subject = (await maria.agent.post('/api/subjects').send({ name: 'Networks' })).body.subject;
        const res = await maria.agent.patch(`/api/flashcards/decks/${deck._id}`).send({ title: 'Layers', subject: subject._id });
        expect(res.status).toBe(200);
        expect(res.body.deck).toMatchObject({ title: 'Layers', subject: subject._id, course: 'Networks' });
        expect((await maria.agent.patch(`/api/flashcards/decks/${deck._id}`).send({ title: '' })).status).toBe(400);
    });

    test('deleting a deck deletes its cards and only its cards', async () => {
        const { maria } = await twoStudents();
        const doomed = await makeDeck(maria.id);
        const kept = await makeDeck(maria.id, { title: 'Kept' });
        await makeCards(maria.id, doomed._id, 3);
        await makeCards(maria.id, kept._id, 2);
        expect((await maria.agent.delete(`/api/flashcards/decks/${doomed._id}`)).body.success).toBe(true);
        expect(await flashcardModel.countDocuments({ deck: doomed._id })).toBe(0);
        expect(await flashcardModel.countDocuments({ deck: kept._id })).toBe(2);
    });

    test('another student\'s deck, an unknown one and a bad id all answer the same 404, and nothing changes', async () => {
        const { maria, jose } = await twoStudents();
        const deck = await makeDeck(maria.id);
        await makeCard(maria.id, deck._id);
        const attempts = [
            [jose.agent, deck._id],
            [maria.agent, '65f000000000000000000000'],
            [maria.agent, 'nope'],
        ];
        for (const [agent, id] of attempts) {
            const responses = [
                await agent.get(`/api/flashcards/decks/${id}`),
                await agent.patch(`/api/flashcards/decks/${id}`).send({ title: 'Mine now' }),
                await agent.delete(`/api/flashcards/decks/${id}`),
                await agent.post(`/api/flashcards/decks/${id}/cards`).send({ term: 'a', answer: 'b' }),
            ];
            responses.forEach((res) => {
                expect(res.status).toBe(404);
                expect(res.body).toEqual({ success: false, message: 'Deck not found.' });
            });
        }
        expect(await flashcardDeckModel.findById(deck._id)).toMatchObject({ title: 'Networking' });
        expect(await flashcardModel.countDocuments()).toBe(1);
    });
});

describe('decks from a reviewer', () => {
    const KEY_TERMS = [
        { term: 'Firewall', definition: 'Filters traffic.' },
        { term: 'TLS', definition: 'Encrypts data in transit.' },
        { term: 'firewall', definition: 'A repeat in another case.' },
    ];

    test('makes one card per key term and answers the same deck the second time', async () => {
        const { maria } = await twoStudents();
        const reviewer = await readyReviewer(maria.id, KEY_TERMS);
        const first = await fromReviewer(maria.agent, String(reviewer._id));
        expect(first.status).toBe(201);
        expect(first.body.added).toBe(2);
        expect(first.body.deck).toMatchObject({
            title: 'Network notes', course: 'IT 301', reviewer: String(reviewer._id), cards: 2, due: 2, status: 'new',
        });

        const second = await fromReviewer(maria.agent, String(reviewer._id));
        expect(second.status).toBe(200);
        expect(second.body.existing).toBe(true);
        expect(second.body.deck.id).toBe(first.body.deck.id);
        expect(await flashcardModel.countDocuments()).toBe(2);
        expect(await aiRequestModel.countDocuments()).toBe(0);
    });

    test('two requests at once still make one deck', async () => {
        const { maria } = await twoStudents();
        const reviewer = await readyReviewer(maria.id, KEY_TERMS);
        const results = await Promise.all([fromReviewer(maria.agent, String(reviewer._id)), fromReviewer(maria.agent, String(reviewer._id))]);
        results.forEach((res) => expect([200, 201]).toContain(res.status));
        expect(await flashcardDeckModel.countDocuments()).toBe(1);
        expect(await flashcardModel.countDocuments()).toBe(2);
    });

    test('keeps out another student\'s reviewer, one still being made and one without key terms', async () => {
        const { maria, jose } = await twoStudents();
        const reviewer = await readyReviewer(maria.id, KEY_TERMS);
        expect((await fromReviewer(jose.agent, String(reviewer._id))).status).toBe(404);

        const busy = await readyReviewer(maria.id, KEY_TERMS, { status: 'processing' });
        const processing = await fromReviewer(maria.agent, String(busy._id));
        expect(processing.status).toBe(409);
        expect(processing.body.message).toBe('This reviewer isn\'t ready yet.');

        const empty = await readyReviewer(maria.id, []);
        expect((await fromReviewer(maria.agent, String(empty._id))).status).toBe(422);

        for (const reviewerId of ['nope', undefined, { $ne: null }, [String(reviewer._id)]]) {
            expect((await fromReviewer(maria.agent, reviewerId)).status).toBe(404);
        }
        expect(await flashcardDeckModel.countDocuments()).toBe(0);
    });

    test('clips long terms and definitions to the card limits', async () => {
        const { maria } = await twoStudents();
        const reviewer = await readyReviewer(maria.id, [{ term: 'T'.repeat(500), definition: 'D'.repeat(1500) }]);
        await fromReviewer(maria.agent, String(reviewer._id));
        const card = await flashcardModel.findOne();
        expect(card.term).toHaveLength(400);
        expect(card.answer).toHaveLength(1000);
    });

    test('refuses a student near 2,000 cards without making a deck', async () => {
        const { maria } = await twoStudents();
        const full = await makeDeck(maria.id, { title: 'Full' });
        await makeCards(maria.id, full._id, 1999);
        const reviewer = await readyReviewer(maria.id, KEY_TERMS);
        expect((await fromReviewer(maria.agent, String(reviewer._id))).status).toBe(400);
        expect(await flashcardDeckModel.countDocuments()).toBe(1);
    });

    test('refuses a student who already has 50 decks', async () => {
        const { maria } = await twoStudents();
        await flashcardDeckModel.insertMany(Array.from({ length: 50 }, (_, i) => ({ owner: maria.id, title: `Deck ${i}` })));
        const reviewer = await readyReviewer(maria.id, KEY_TERMS);
        expect((await fromReviewer(maria.agent, String(reviewer._id))).status).toBe(400);
        expect(await flashcardDeckModel.countDocuments()).toBe(50);
    });
});

describe('cards', () => {
    test('adds, edits and deletes one', async () => {
        const { maria } = await twoStudents();
        const deck = await makeDeck(maria.id);
        const added = await maria.agent.post(`/api/flashcards/decks/${deck._id}/cards`)
            .send({ term: ' Subnet  mask ', answer: 'Line one\r\n\r\n\r\nLine two' });
        expect(added.status).toBe(201);
        expect(added.body.card).toMatchObject({ deckId: String(deck._id), term: 'Subnet mask', answer: 'Line one\n\nLine two', due: true });

        const id = added.body.card.id;
        const edited = await maria.agent.patch(`/api/flashcards/cards/${id}`).send({ answer: 'Marks the network bits.' });
        expect(edited.body.card).toMatchObject({ term: 'Subnet mask', answer: 'Marks the network bits.' });
        expect((await maria.agent.patch(`/api/flashcards/cards/${id}`).send({ term: '' })).status).toBe(400);

        expect((await maria.agent.delete(`/api/flashcards/cards/${id}`)).body.success).toBe(true);
        expect(await flashcardModel.countDocuments()).toBe(0);
    });

    test('editing the text leaves the schedule alone, and the schedule cannot be sent in', async () => {
        const { maria } = await twoStudents();
        const deck = await makeDeck(maria.id);
        const dueAt = new Date(Date.now() + 5 * DAY);
        const card = await makeCard(maria.id, deck._id, { box: 3, dueAt, reviews: 4 });
        await maria.agent.patch(`/api/flashcards/cards/${card._id}`).send({ term: 'Edited', box: 0, dueAt: new Date(), reviews: 99 });
        const saved = await flashcardModel.findById(card._id);
        expect(saved).toMatchObject({ term: 'Edited', box: 3, reviews: 4 });
        expect(saved.dueAt).toEqual(dueAt);

        await maria.agent.post(`/api/flashcards/decks/${deck._id}/cards`)
            .send({ term: 'New', answer: 'Card', box: 5, dueAt, owner: String(card._id) });
        const created = await flashcardModel.findOne({ term: 'New' });
        expect(created.box).toBe(0);
        expect(String(created.owner)).toBe(String(maria.id));
        expect(created.dueAt.getTime()).toBeLessThan(Date.now() + 1000);
    });

    test('checks the limits on the front and back and reads strings only', async () => {
        const { maria } = await twoStudents();
        const deck = await makeDeck(maria.id);
        const add = (body) => maria.agent.post(`/api/flashcards/decks/${deck._id}/cards`).send(body);
        expect((await add({ term: 'a'.repeat(400), answer: 'b'.repeat(1000) })).status).toBe(201);
        expect((await add({ term: 'a'.repeat(401), answer: 'b' })).status).toBe(400);
        expect((await add({ term: 'a', answer: 'b'.repeat(1001) })).status).toBe(400);
        expect((await add({ term: { $gt: '' }, answer: 'b' })).status).toBe(400);
        expect((await add({ term: 'a', answer: ['b'] })).status).toBe(400);
        expect((await add({ answer: 'b' })).status).toBe(400);
        expect(await flashcardModel.countDocuments()).toBe(1);
    });

    test('stops at 200 cards in a deck and 2,000 for a student', async () => {
        const { maria } = await twoStudents();
        const deck = await makeDeck(maria.id);
        await makeCards(maria.id, deck._id, 200);
        expect((await maria.agent.post(`/api/flashcards/decks/${deck._id}/cards`).send({ term: 'a', answer: 'b' })).status).toBe(400);

        const other = await makeDeck(maria.id, { title: 'Other' });
        await makeCards(maria.id, other._id, 1800);
        const empty = await makeDeck(maria.id, { title: 'Empty' });
        expect((await maria.agent.post(`/api/flashcards/decks/${empty._id}/cards`).send({ term: 'a', answer: 'b' })).status).toBe(400);
        expect(await flashcardModel.countDocuments()).toBe(2000);
    });

    test('another student\'s cards can\'t be added to, edited, deleted or rated, and nothing changes', async () => {
        const { maria, jose } = await twoStudents();
        const deck = await makeDeck(maria.id);
        const card = await makeCard(maria.id, deck._id);
        const attempts = [
            () => jose.agent.post(`/api/flashcards/decks/${deck._id}/cards`).send({ term: 'a', answer: 'b' }),
            () => jose.agent.patch(`/api/flashcards/cards/${card._id}`).send({ term: 'Hacked' }),
            () => jose.agent.delete(`/api/flashcards/cards/${card._id}`),
            () => jose.agent.post(`/api/flashcards/cards/${card._id}/rate`).send({ rating: 'got' }),
            () => jose.agent.delete('/api/flashcards/cards/nope'),
        ];
        for (const attempt of attempts) expect((await attempt()).status).toBe(404);
        expect(await flashcardModel.countDocuments()).toBe(1);
        expect(await flashcardModel.findById(card._id)).toMatchObject({ term: 'Firewall', box: 0, reviews: 0 });
    });
});

describe('review', () => {
    test('gives at most 50 of 60 due cards and says how many are due', async () => {
        const { maria } = await twoStudents();
        const deck = await makeDeck(maria.id);
        await makeCards(maria.id, deck._id, 60);
        const res = await maria.agent.get('/api/flashcards/review');
        expect(res.body).toMatchObject({ success: true, mode: 'due', dueTotal: 60, deck: null });
        expect(res.body.cards).toHaveLength(50);
        expect(Object.keys(res.body.cards[0]).sort()).toEqual(['answer', 'id', 'term']);
    });

    test('leaves out cards that are not due, and other students\' cards', async () => {
        const { maria, jose } = await twoStudents();
        const deck = await makeDeck(maria.id);
        await makeCard(maria.id, deck._id, { term: 'Later', dueAt: new Date(Date.now() + 5 * DAY) });
        await makeCard(maria.id, deck._id, { term: 'Today' });
        const res = await maria.agent.get('/api/flashcards/review');
        expect(res.body.cards.map((card) => card.term)).toEqual(['Today']);
        expect((await jose.agent.get('/api/flashcards/review')).body).toMatchObject({ cards: [], dueTotal: 0, mode: 'due' });
    });

    test('a deck with nothing due is a practice run over all its cards', async () => {
        const { maria } = await twoStudents();
        const deck = await makeDeck(maria.id, { course: 'IT 301' });
        await makeCards(maria.id, deck._id, 3, { dueAt: new Date(Date.now() + 5 * DAY) });
        const res = await maria.agent.get(`/api/flashcards/review?deck=${deck._id}`);
        expect(res.body).toMatchObject({ mode: 'all', dueTotal: 0, deck: { id: String(deck._id), title: 'Networking', course: 'IT 301' } });
        expect(res.body.cards).toHaveLength(3);
    });

    test('a deck query that is foreign, malformed or repeated is a 404', async () => {
        const { maria, jose } = await twoStudents();
        const deck = await makeDeck(maria.id);
        await makeCard(maria.id, deck._id);
        for (const query of [`deck=${deck._id}`, 'deck=nope', `deck=${deck._id}&deck=${deck._id}`, 'deck=']) {
            expect((await jose.agent.get(`/api/flashcards/review?${query}`)).status, query).toBe(404);
        }
        expect((await maria.agent.get(`/api/flashcards/review?deck=nope&deck=${deck._id}`)).status).toBe(404);
    });

    test('bracket forms of the deck query are not a deck, and still show only their own cards', async () => {
        const { maria, jose } = await twoStudents();
        const deck = await makeDeck(maria.id);
        await makeCard(maria.id, deck._id);
        for (const query of [`deck[]=${deck._id}`, 'deck[a]=x']) {
            const res = await jose.agent.get(`/api/flashcards/review?${query}`);
            expect(res.body).toMatchObject({ success: true, cards: [], deck: null });
        }
    });

    test('no response carries the owner, the box, the lapses or a reviewer\'s source text', async () => {
        const { maria } = await twoStudents();
        const reviewer = await readyReviewer(maria.id, [{ term: 'Firewall', definition: 'Filters traffic.' }], { sourceText: 'SECRET NOTES' });
        const made = await fromReviewer(maria.agent, String(reviewer._id));
        const deckId = made.body.deck.id;
        const cardId = (await flashcardModel.findOne())._id;
        const bodies = [
            made.body,
            (await maria.agent.get('/api/flashcards')).body,
            (await maria.agent.get(`/api/flashcards/decks/${deckId}`)).body,
            (await maria.agent.get(`/api/flashcards/review?deck=${deckId}`)).body,
            (await maria.agent.patch(`/api/flashcards/decks/${deckId}`).send({ title: 'Renamed' })).body,
            (await maria.agent.patch(`/api/flashcards/cards/${cardId}`).send({ term: 'Edited' })).body,
            (await maria.agent.post(`/api/flashcards/cards/${cardId}/rate`).send({ rating: 'got' })).body,
        ];
        bodies.forEach((body) => {
            const text = JSON.stringify(body);
            ['owner', 'box', 'lapses', 'sourceText', 'SECRET'].forEach((word) => expect(text).not.toContain(word));
        });
    });
});

describe('rating', () => {
    test('got on a due card moves it out, and a second got changes nothing', async () => {
        const { maria } = await twoStudents();
        const deck = await makeDeck(maria.id);
        const card = await makeCard(maria.id, deck._id);
        const rate = () => maria.agent.post(`/api/flashcards/cards/${card._id}/rate`).send({ rating: 'got' });

        const first = await rate();
        expect(first.body).toMatchObject({ success: true, counted: true, due: false });
        const saved = await flashcardModel.findById(card._id);
        expect(saved).toMatchObject({ box: 1, reviews: 1 });
        expect(saved.dueAt.getTime()).toBeGreaterThan(Date.now());

        const again = await rate();
        expect(again.body).toMatchObject({ counted: false, due: false });
        expect(await flashcardModel.findById(card._id)).toMatchObject({ box: 1, reviews: 1 });
    });

    test('learning puts the card back and keeps it due', async () => {
        const { maria } = await twoStudents();
        const deck = await makeDeck(maria.id);
        const card = await makeCard(maria.id, deck._id, { box: 3, dueAt: new Date(Date.now() + 5 * DAY) });
        const res = await maria.agent.post(`/api/flashcards/cards/${card._id}/rate`).send({ rating: 'learning' });
        expect(res.body).toMatchObject({ counted: true, due: true });
        expect(await flashcardModel.findById(card._id)).toMatchObject({ box: 0, lapses: 1, reviews: 1 });
    });

    test('anything but the two ratings is a 400 and changes nothing', async () => {
        const { maria } = await twoStudents();
        const deck = await makeDeck(maria.id);
        const card = await makeCard(maria.id, deck._id);
        for (const rating of ['easy', '', undefined, { $ne: 'got' }, ['got']]) {
            const res = await maria.agent.post(`/api/flashcards/cards/${card._id}/rate`).send({ rating });
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Pick Got it or Still learning.');
        }
        expect(await flashcardModel.findById(card._id)).toMatchObject({ box: 0, reviews: 0 });
    });
});

describe('the flashcards tab', () => {
    test('lists the student\'s decks with counts, the due total and the reviewers that can become decks', async () => {
        const { maria, jose } = await twoStudents();
        const reviewer = await readyReviewer(maria.id, [{ term: 'A', definition: 'a' }, { term: 'B', definition: 'b' }], { sourceText: 'SECRET NOTES' });
        await readyReviewer(maria.id, [], { title: 'Not ready', status: 'processing' });
        const made = await fromReviewer(maria.agent, String(reviewer._id));
        const manual = await makeDeck(maria.id, { title: 'Subnetting' });
        await makeCards(maria.id, manual._id, 4, { box: 4, dueAt: new Date(Date.now() + 2 * DAY), reviewedAt: new Date() });
        await makeCards(maria.id, manual._id, 2);
        const josesDeck = await makeDeck(jose.id, { title: 'Jose deck' });
        await makeCards(jose.id, josesDeck._id, 3);

        const { body } = await maria.agent.get('/api/flashcards');
        expect(body.decks.map((deck) => deck.title)).toEqual(['Subnetting', 'Network notes']);
        expect(body.decks[0]).toMatchObject({ cards: 6, due: 2, status: 'learning', nextDueDays: null });
        expect(body.decks[1]).toMatchObject({ id: made.body.deck.id, cards: 2, due: 2, status: 'new' });
        expect(body.due).toEqual({ cards: 4, decks: 2 });
        expect(body.sources).toEqual([{
            reviewerId: String(reviewer._id), title: 'Network notes', course: 'IT 301', subject: null, terms: 2, deckId: made.body.deck.id,
        }]);
        expect(body.limits).toMatchObject({ decks: 50, cardsPerDeck: 200, cardsPerUser: 2000, term: 400, answer: 1000 });
        expect(JSON.stringify(body)).not.toContain('SECRET');

        const theirs = (await jose.agent.get('/api/flashcards')).body;
        expect(theirs.decks.map((deck) => deck.title)).toEqual(['Jose deck']);
        expect(theirs.sources).toEqual([]);
    });

    test('a deck with nothing due says when its cards come back', async () => {
        const { maria } = await twoStudents();
        const deck = await makeDeck(maria.id);
        await makeCards(maria.id, deck._id, 2, { box: 4, dueAt: new Date(Date.now() + 3 * DAY), reviewedAt: new Date() });
        const { body } = await maria.agent.get(`/api/flashcards/decks/${deck._id}`);
        expect(body.deck).toMatchObject({ cards: 2, due: 0, status: 'mastered' });
        expect(body.deck.nextDueDays).toBeGreaterThanOrEqual(2);
        expect(body.cards).toHaveLength(2);
        expect(body.cards[0]).toMatchObject({ deckId: String(deck._id), due: false });
    });
});

describe('what happens to decks around them', () => {
    test('renaming a subject relabels its decks; deleting it unlinks them and they keep the label', async () => {
        const { maria } = await twoStudents();
        const subject = (await maria.agent.post('/api/subjects').send({ name: 'Networks' })).body.subject;
        const deck = (await maria.agent.post('/api/flashcards/decks').send({ title: 'Layers', subject: subject._id })).body.deck;

        await maria.agent.patch(`/api/subjects/${subject._id}`).send({ name: 'Computer Networks' });
        expect(await flashcardDeckModel.findById(deck.id)).toMatchObject({ course: 'Computer Networks' });

        await maria.agent.delete(`/api/subjects/${subject._id}?files=keep`);
        const saved = await flashcardDeckModel.findById(deck.id);
        expect(saved.subject).toBeNull();
        expect(saved.course).toBe('Computer Networks');
    });

    test('deleting a reviewer leaves its deck and cards, with no reviewer', async () => {
        const { maria } = await twoStudents();
        const reviewer = await readyReviewer(maria.id, [{ term: 'A', definition: 'a' }]);
        const deck = (await fromReviewer(maria.agent, String(reviewer._id))).body.deck;
        expect((await maria.agent.delete(`/api/reviewers/${reviewer._id}`)).body.success).toBe(true);
        expect(await flashcardDeckModel.findById(deck.id)).toMatchObject({ reviewer: null });
        expect(await flashcardModel.countDocuments({ deck: deck.id })).toBe(1);
    });

    test('deleting a student\'s data removes their decks and cards and nobody else\'s', async () => {
        const { maria, jose } = await twoStudents();
        const mine = await makeDeck(maria.id);
        const theirs = await makeDeck(jose.id);
        await makeCards(maria.id, mine._id, 3);
        await makeCards(jose.id, theirs._id, 2);
        await deleteUserData(maria.id);
        expect(await flashcardDeckModel.countDocuments({ owner: maria.id })).toBe(0);
        expect(await flashcardModel.countDocuments({ owner: maria.id })).toBe(0);
        expect(await flashcardDeckModel.countDocuments({ owner: jose.id })).toBe(1);
        expect(await flashcardModel.countDocuments({ owner: jose.id })).toBe(2);
    });
});
