import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';
import groupMessageModel from '../models/groupMessageModel.js';
import subjectModel, { SUBJECT_LIMITS } from '../models/subjectModel.js';
import flashcardDeckModel, { FLASHCARD_LIMITS } from '../models/flashcardDeckModel.js';
import flashcardModel from '../models/flashcardModel.js';
import scheduleModel from '../models/scheduleModel.js';
import notificationModel from '../models/notificationModel.js';

vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(connectTestDB);
beforeEach(clearTestDB);
afterAll(closeTestDB);

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

const TUE_THU = { days: [2, 4], startTime: '08:00', endTime: '09:30', location: 'Rm 305' };
const FRIDAY = { days: [5], startTime: '13:00', endTime: '16:00', location: 'Lab 2', meetingUrl: 'https://meet.example.com/web' };

const makeSubject = async (agent, body = {}) => {
    const res = await agent.post('/api/subjects').send({ name: 'Web Systems', code: 'IT 304', term: '1st Sem', classTimes: [TUE_THU, FRIDAY], ...body });
    return res.body.subject;
};

const makeDeck = async (owner, { title = 'Routing terms', course = 'IT 304', cards = 40 } = {}) => {
    const deck = await flashcardDeckModel.create({ owner: owner.id, title, course });
    await flashcardModel.insertMany(Array.from({ length: cards }, (_, i) => ({
        owner: owner.id, deck: deck._id, term: `Term ${i + 1}`, answer: `Answer ${i + 1}`,
    })));
    return deck;
};

const send = (agent, group, body) => agent.post(`/api/groups/${group._id}/messages`).send(body);
const shareSubject = (agent, group, subject) => send(agent, group, { subjectId: String(subject._id) });
const shareDeck = (agent, group, deck) => send(agent, group, { deckId: String(deck._id) });
const save = (agent, group, messageId) => agent.post(`/api/groups/${group._id}/messages/${messageId}/save`);
const messagesOf = async (agent, group) => (await agent.get(`/api/groups/${group._id}/messages`)).body.messages;
const mainEntries = async (agent) => (await scheduleModel.findOne({ owner: agent.id, isMain: true }).lean())?.entries ?? [];

describe('sharing a subject', () => {
    test('posts a card with the class times, and nothing private', async () => {
        const { alice, bob, group } = await setup();
        const subject = await makeSubject(alice);
        await subjectModel.updateOne({ _id: subject._id }, { notes: 'alice private notes' });

        const sent = await shareSubject(alice, group, subject);
        expect(sent.status).toBe(200);
        expect(sent.body.message).toMatchObject({
            type: 'subject',
            addedByMe: false,
            subject: {
                name: 'Web Systems',
                code: 'IT 304',
                term: '1st Sem',
                classTimes: [
                    { days: [2, 4], startTime: '08:00', endTime: '09:30', location: 'Rm 305' },
                    { days: [5], startTime: '13:00', endTime: '16:00', location: 'Lab 2', meetingUrl: 'https://meet.example.com/web' },
                ],
            },
        });
        const json = JSON.stringify((await bob.get(`/api/groups/${group._id}/messages`)).body);
        expect(json).not.toContain('private notes');
        expect(json).not.toContain(subject._id);
    });

    test('a subject without class times shares with an empty list', async () => {
        const { alice, group } = await setup();
        const sent = await shareSubject(alice, group, await makeSubject(alice, { classTimes: [] }));
        expect(sent.status).toBe(200);
        expect(sent.body.message.subject.classTimes).toEqual([]);
    });

    test('sharing a subject someone else owns, or one that does not exist, is 404', async () => {
        const { alice, bob, group } = await setup();
        const bobs = await makeSubject(bob, { name: 'Operating Systems', code: 'IT 305', classTimes: [] });
        expect((await shareSubject(alice, group, bobs)).status).toBe(404);
        expect((await send(alice, group, { subjectId: 'nope' })).status).toBe(404);
        expect((await send(alice, group, { subjectId: '507f1f77bcf86cd799439011' })).status).toBe(404);
        expect(await groupMessageModel.countDocuments()).toBe(0);
    });

    test('an archived subject can not be shared', async () => {
        const { alice, group } = await setup();
        const subject = await makeSubject(alice);
        await subjectModel.updateOne({ _id: subject._id }, { archivedAt: new Date() });
        expect((await shareSubject(alice, group, subject)).status).toBe(404);
    });

    test('an outsider gets 404 for sharing into the group', async () => {
        const { carol, group } = await setup();
        expect((await shareSubject(carol, group, await makeSubject(carol))).status).toBe(404);
    });

    test('a family-friendly group refuses a filtered subject name or room', async () => {
        const { alice, group } = await setup();
        await alice.patch(`/api/groups/${group._id}`).send({ familyFriendly: true });
        const rude = await makeSubject(alice, { name: 'Porn Studies', classTimes: [] });
        const refused = await shareSubject(alice, group, rude);
        expect(refused.status).toBe(400);
        expect(refused.body.code).toBe('family_filter');

        const rudeRoom = await makeSubject(alice, { name: 'Ethics', code: '', classTimes: [{ ...TUE_THU, location: 'The shit room' }] });
        expect((await shareSubject(alice, group, rudeRoom)).body.code).toBe('family_filter');
        expect(await groupMessageModel.countDocuments()).toBe(0);

        const clean = await makeSubject(alice, { name: 'Calculus', code: '', classTimes: [] });
        expect((await shareSubject(alice, group, clean)).status).toBe(200);
    });
});

describe('adding a shared subject', () => {
    test('makes the subject and its linked class times in the main timetable', async () => {
        const { alice, bob, dave, group } = await setup();
        const messageId = (await shareSubject(alice, group, await makeSubject(alice))).body.message._id;

        const res = await save(bob, group, messageId);
        expect(res.status).toBe(201);
        expect(res.body.saved).toMatchObject({ type: 'subject', title: 'Web Systems', classTimesAdded: 2 });

        const subject = await subjectModel.findById(res.body.saved._id).lean();
        expect(subject).toMatchObject({ name: 'Web Systems', code: 'IT 304', term: '1st Sem', importedFrom: [`message:${messageId}`] });
        expect(String(subject.owner)).toBe(bob.id);

        const entries = await mainEntries(bob);
        expect(entries).toHaveLength(2);
        entries.forEach((entry) => {
            expect(entry).toMatchObject({ kind: 'class', title: 'Web Systems' });
            expect(String(entry.subject)).toBe(String(subject._id));
        });
        expect(entries.map((e) => e.location).sort()).toEqual(['Lab 2', 'Rm 305']);
        expect((await bob.get('/api/subjects')).body.subjects[0].counts.classTimes).toBe(2);

        // The card reads as added for Bob only, and the subject response never carries the token.
        expect((await messagesOf(bob, group))[0].addedByMe).toBe(true);
        expect((await messagesOf(dave, group))[0].addedByMe).toBe(false);
        expect(JSON.stringify((await bob.get('/api/subjects')).body)).not.toContain('importedFrom');
    });

    test('saving again answers 409 alreadyAdded and adds nothing', async () => {
        const { alice, bob, group } = await setup();
        const messageId = (await shareSubject(alice, group, await makeSubject(alice))).body.message._id;
        expect((await save(bob, group, messageId)).status).toBe(201);

        const again = await save(bob, group, messageId);
        expect(again.status).toBe(409);
        expect(again.body.alreadyAdded).toBe(true);
        expect(await subjectModel.countDocuments({ owner: bob.id })).toBe(1);
        expect(await mainEntries(bob)).toHaveLength(2);
    });

    test('two saves at the same moment make one subject with one set of class times', async () => {
        const { alice, bob, group } = await setup();
        await subjectModel.init();
        const messageId = (await shareSubject(alice, group, await makeSubject(alice))).body.message._id;
        const statuses = (await Promise.all([save(bob, group, messageId), save(bob, group, messageId)])).map((r) => r.status);
        expect(statuses.sort()).toEqual([201, 409]);
        expect(await subjectModel.countDocuments({ owner: bob.id })).toBe(1);
        expect(await mainEntries(bob)).toHaveLength(2);
    });

    test('a subject the groupmate already has is reused and only the missing class times are added', async () => {
        const { alice, bob, group } = await setup();
        const mine = await makeSubject(bob, { name: 'Web Systems', code: '', term: 'Mine', classTimes: [TUE_THU] });
        const messageId = (await shareSubject(alice, group, await makeSubject(alice))).body.message._id;

        const res = await save(bob, group, messageId);
        expect(res.status).toBe(201);
        expect(res.body.saved).toMatchObject({ _id: mine._id, classTimesAdded: 1 });
        expect(await subjectModel.countDocuments({ owner: bob.id })).toBe(1);

        const subject = await subjectModel.findById(mine._id).lean();
        expect(subject).toMatchObject({ term: 'Mine', importedFrom: [`message:${messageId}`] });
        const entries = await mainEntries(bob);
        expect(entries).toHaveLength(2);
        expect(entries.every((e) => String(e.subject) === mine._id)).toBe(true);

        expect((await save(bob, group, messageId)).status).toBe(409);
        expect(await mainEntries(bob)).toHaveLength(2);
        expect((await messagesOf(bob, group))[0].addedByMe).toBe(true);
    });

    test('a groupmate at the subject limit gets the cap message and nothing is saved', async () => {
        const { alice, bob, group } = await setup();
        await subjectModel.insertMany(Array.from({ length: SUBJECT_LIMITS.maxActive }, (_, i) => ({ owner: bob.id, name: `Subject ${i + 1}`, order: i })));
        const messageId = (await shareSubject(alice, group, await makeSubject(alice))).body.message._id;

        const res = await save(bob, group, messageId);
        expect(res.status).toBe(400);
        expect(res.body.message).toBe(`You can have up to ${SUBJECT_LIMITS.maxActive} subjects. Delete one you no longer need first.`);
        expect(await subjectModel.countDocuments({ owner: bob.id })).toBe(SUBJECT_LIMITS.maxActive);
        expect(await mainEntries(bob)).toHaveLength(0);
    });

    test('a full timetable refuses the add and leaves no subject behind', async () => {
        const { alice, bob, group } = await setup();
        const messageId = (await shareSubject(alice, group, await makeSubject(alice))).body.message._id;
        const filler = Array.from({ length: 79 }, (_, i) => ({
            title: `Filler ${i}`, kind: 'class', days: [i % 7], startTime: '06:00', endTime: '06:30',
        }));
        await scheduleModel.create({ owner: bob.id, title: 'My week', isMain: true, entries: filler });

        const res = await save(bob, group, messageId);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/up to 80 entries/);
        expect(await subjectModel.countDocuments({ owner: bob.id })).toBe(0);
        expect(await mainEntries(bob)).toHaveLength(79);
    });

    test('deleting the subject lets the groupmate add it again', async () => {
        const { alice, bob, group } = await setup();
        const messageId = (await shareSubject(alice, group, await makeSubject(alice))).body.message._id;
        const first = (await save(bob, group, messageId)).body.saved;
        expect((await bob.delete(`/api/subjects/${first._id}`)).status).toBe(200);
        expect((await messagesOf(bob, group))[0].addedByMe).toBe(false);
        expect((await save(bob, group, messageId)).status).toBe(201);
    });

    test('outsiders and deleted messages answer 404', async () => {
        const { alice, bob, carol, group } = await setup();
        const messageId = (await shareSubject(alice, group, await makeSubject(alice))).body.message._id;
        expect((await save(carol, group, messageId)).status).toBe(404);

        expect((await alice.delete(`/api/groups/${group._id}/messages/${messageId}`)).status).toBe(200);
        expect((await save(bob, group, messageId)).status).toBe(404);
        expect(await subjectModel.countDocuments({ owner: bob.id })).toBe(0);
        const stored = await groupMessageModel.findById(messageId).lean();
        expect(stored.type).toBe('deleted');
        expect(stored.subject).toBeUndefined();
    });

    test('the share outlives the original subject', async () => {
        const { alice, bob, group } = await setup();
        const subject = await makeSubject(alice);
        const messageId = (await shareSubject(alice, group, subject)).body.message._id;
        expect((await alice.delete(`/api/subjects/${subject._id}`)).status).toBe(200);
        const res = await save(bob, group, messageId);
        expect(res.status).toBe(201);
        expect(res.body.saved.classTimesAdded).toBe(2);
    });
});

describe('sharing a deck', () => {
    test('posts a card with the card count and keeps the card text out of every message list', async () => {
        const { alice, bob, group } = await setup();
        const deck = await makeDeck(alice);

        const sent = await shareDeck(alice, group, deck);
        expect(sent.status).toBe(200);
        expect(sent.body.message).toMatchObject({ type: 'deck', addedByMe: false, deck: { title: 'Routing terms', course: 'IT 304', cardCount: 40 } });
        const messageId = sent.body.message._id;

        const expectNoCards = (body) => {
            const json = JSON.stringify(body);
            ['deckContent', 'Term 1', 'Answer 1'].forEach((leak) => expect(json, leak).not.toContain(leak));
        };
        expectNoCards(sent.body);
        const list = await bob.get(`/api/groups/${group._id}/messages`);
        expectNoCards(list.body);
        expect(list.body.messages).toHaveLength(1);

        const since = new Date(Date.now() - 1000).toISOString();
        await bob.put(`/api/groups/${group._id}/messages/${messageId}/reactions`).send({ emoji: '\u{1F44D}', on: true });
        expectNoCards((await bob.get(`/api/groups/${group._id}/messages?after=${messageId}&since=${since}`)).body);
        expectNoCards((await bob.get(`/api/groups/${group._id}/upcoming`)).body);

        // The cards are stored, just never sent.
        const stored = await groupMessageModel.findById(messageId).select('+deckContent').lean();
        expect(stored.deckContent.cards).toHaveLength(40);
        expect(stored.deckContent.cards[0]).toEqual({ term: 'Term 1', answer: 'Answer 1' });
    });

    test('only the owner can share, and only a deck with cards', async () => {
        const { alice, bob, group } = await setup();
        expect((await shareDeck(alice, group, await makeDeck(bob))).status).toBe(404);
        expect((await send(alice, group, { deckId: 'nope' })).status).toBe(404);
        const empty = await shareDeck(alice, group, await makeDeck(alice, { cards: 0 }));
        expect(empty.status).toBe(400);
        expect(empty.body.message).toMatch(/card/i);
        expect(await groupMessageModel.countDocuments()).toBe(0);
    });

    test('an outsider gets 404 for sharing into the group', async () => {
        const { carol, group } = await setup();
        expect((await shareDeck(carol, group, await makeDeck(carol))).status).toBe(404);
    });

    test('a family-friendly group refuses a filtered card term or answer', async () => {
        const { alice, group } = await setup();
        await alice.patch(`/api/groups/${group._id}`).send({ familyFriendly: true });
        const deck = await makeDeck(alice, { cards: 3 });
        await flashcardModel.updateOne({ deck: deck._id, term: 'Term 2' }, { term: 'Bullshit' });

        const refused = await shareDeck(alice, group, deck);
        expect(refused.status).toBe(400);
        expect(refused.body.code).toBe('family_filter');

        await flashcardModel.updateOne({ deck: deck._id, term: 'Bullshit' }, { term: 'Fine', answer: 'what the fuck' });
        expect((await shareDeck(alice, group, deck)).body.code).toBe('family_filter');
        expect(await groupMessageModel.countDocuments()).toBe(0);

        await flashcardModel.updateOne({ deck: deck._id, term: 'Fine' }, { answer: 'Fine' });
        expect((await shareDeck(alice, group, deck)).status).toBe(200);
    });
});

describe('saving a shared deck', () => {
    test('gives the groupmate a deck of their own with every card due now', async () => {
        const { alice, bob, dave, group } = await setup();
        await makeSubject(bob, { name: 'Web Systems', code: 'WS', classTimes: [] });
        const original = await makeDeck(alice, { course: 'ws' });
        await flashcardModel.updateMany({ deck: original._id }, { box: 4, reviews: 9, dueAt: new Date(Date.now() + 86400000 * 30) });
        const messageId = (await shareDeck(alice, group, original)).body.message._id;

        const res = await save(bob, group, messageId);
        expect(res.status).toBe(201);
        expect(res.body.saved).toMatchObject({ type: 'deck', title: 'Routing terms' });

        const deck = await flashcardDeckModel.findById(res.body.saved._id).lean();
        expect(String(deck.owner)).toBe(bob.id);
        expect(deck).toMatchObject({ title: 'Routing terms', course: 'WS', copiedFrom: `message:${messageId}` });
        expect(deck.subject).not.toBeNull();

        const cards = await flashcardModel.find({ deck: deck._id }).sort({ createdAt: 1, _id: 1 }).lean();
        expect(cards).toHaveLength(40);
        expect(cards[0]).toMatchObject({ term: 'Term 1', answer: 'Answer 1', box: 0, reviews: 0, lapses: 0, reviewedAt: null });
        expect(cards.every((c) => String(c.owner) === bob.id && c.dueAt <= new Date())).toBe(true);

        // Alice's own deck is untouched.
        expect(await flashcardModel.countDocuments({ deck: original._id, owner: alice.id, box: 4 })).toBe(40);
        expect((await messagesOf(bob, group))[0].addedByMe).toBe(true);
        expect((await messagesOf(dave, group))[0].addedByMe).toBe(false);
    });

    test('keeps the course as typed when the groupmate has no matching subject', async () => {
        const { alice, bob, group } = await setup();
        const messageId = (await shareDeck(alice, group, await makeDeck(alice, { cards: 2 }))).body.message._id;
        const deck = await flashcardDeckModel.findById((await save(bob, group, messageId)).body.saved._id).lean();
        expect(deck).toMatchObject({ course: 'IT 304', subject: null });
    });

    test('saving again answers 409 alreadyAdded, and two at once make one deck', async () => {
        const { alice, bob, group } = await setup();
        await flashcardDeckModel.init();
        const messageId = (await shareDeck(alice, group, await makeDeck(alice, { cards: 5 }))).body.message._id;
        const statuses = (await Promise.all([save(bob, group, messageId), save(bob, group, messageId)])).map((r) => r.status);
        expect(statuses.sort()).toEqual([201, 409]);

        const again = await save(bob, group, messageId);
        expect(again.status).toBe(409);
        expect(again.body.alreadyAdded).toBe(true);
        expect(await flashcardDeckModel.countDocuments({ owner: bob.id })).toBe(1);
        expect(await flashcardModel.countDocuments({ owner: bob.id })).toBe(5);
    });

    test('a groupmate at the card limit gets the limit message and nothing is saved', async () => {
        const { alice, bob, group } = await setup();
        const full = await flashcardDeckModel.create({ owner: bob.id, title: 'Everything' });
        await flashcardModel.insertMany(Array.from({ length: FLASHCARD_LIMITS.cardsPerUser }, (_, i) => ({
            owner: bob.id, deck: full._id, term: `T${i}`, answer: `A${i}`,
        })));
        const messageId = (await shareDeck(alice, group, await makeDeck(alice))).body.message._id;

        const res = await save(bob, group, messageId);
        expect(res.status).toBe(400);
        expect(res.body.message).toBe(`You can keep up to ${FLASHCARD_LIMITS.cardsPerUser} cards. Delete some you no longer need first.`);
        expect(await flashcardDeckModel.countDocuments({ owner: bob.id })).toBe(1);
        expect(await flashcardModel.countDocuments({ owner: bob.id })).toBe(FLASHCARD_LIMITS.cardsPerUser);
    });

    test('a groupmate at the deck limit gets the deck message', async () => {
        const { alice, bob, group } = await setup();
        await flashcardDeckModel.insertMany(Array.from({ length: FLASHCARD_LIMITS.decks }, (_, i) => ({ owner: bob.id, title: `Deck ${i}` })));
        const messageId = (await shareDeck(alice, group, await makeDeck(alice, { cards: 3 }))).body.message._id;

        const res = await save(bob, group, messageId);
        expect(res.status).toBe(400);
        expect(res.body.message).toBe(`You can have up to ${FLASHCARD_LIMITS.decks} decks. Delete one you no longer need first.`);
        expect(await flashcardDeckModel.countDocuments({ owner: bob.id })).toBe(FLASHCARD_LIMITS.decks);
    });

    test('outsiders and deleted messages answer 404, and deleting the message drops the stored cards', async () => {
        const { alice, bob, carol, group } = await setup();
        const messageId = (await shareDeck(alice, group, await makeDeck(alice, { cards: 3 }))).body.message._id;
        expect((await save(carol, group, messageId)).status).toBe(404);

        expect((await alice.delete(`/api/groups/${group._id}/messages/${messageId}`)).status).toBe(200);
        expect((await save(bob, group, messageId)).status).toBe(404);
        expect(await flashcardDeckModel.countDocuments({ owner: bob.id })).toBe(0);

        const stored = await groupMessageModel.findById(messageId).select('+deckContent').lean();
        expect(stored.type).toBe('deleted');
        expect(stored.deck).toBeUndefined();
        expect(stored.deckContent).toBeUndefined();
    });

    test('the share outlives the original deck', async () => {
        const { alice, bob, group } = await setup();
        const deck = await makeDeck(alice, { cards: 4 });
        const messageId = (await shareDeck(alice, group, deck)).body.message._id;
        await flashcardModel.deleteMany({ deck: deck._id });
        await flashcardDeckModel.deleteOne({ _id: deck._id });
        expect((await save(bob, group, messageId)).status).toBe(201);
        expect(await flashcardModel.countDocuments({ owner: bob.id })).toBe(4);
    });
});

describe('group_share notifications', () => {
    test('tell the group who shared which subject and deck', async () => {
        const { alice, bob, group } = await setup();
        await shareSubject(alice, group, await makeSubject(alice));
        await shareDeck(alice, group, await makeDeck(alice, { cards: 2 }));
        const notes = await notificationModel.find({ recipient: bob.id, type: 'group_share' }).lean();
        expect(notes.map((n) => n.message).sort()).toEqual(['Alice shared a flashcard deck: Routing terms', 'Alice shared a subject: Web Systems']);
    });
});
