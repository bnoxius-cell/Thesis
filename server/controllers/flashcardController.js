import mongoose from 'mongoose';
import flashcardDeckModel, { FLASHCARD_LIMITS } from '../models/flashcardDeckModel.js';
import flashcardModel from '../models/flashcardModel.js';
import reviewerModel from '../models/reviewerModel.js';
import { isId, serverError } from '../utils/httpErrors.js';
import { applyItemSubject, resolveItemSubject } from '../utils/subjectMatch.js';
import { readCardFields } from '../utils/flashcardCards.js';
import { MASTERED_BOX, applyRating, deckStatus, isDue, nextDueDays, tomorrowStart } from '../utils/flashcardSchedule.js';
import { shuffled } from '../utils/shuffle.js';

const bad = (res, message, status = 400) => res.status(status).json({ success: false, message });
const notFound = (res, what) => bad(res, `${what} not found.`, 404);
const asObjectId = (id) => new mongoose.Types.ObjectId(String(id));

const DECK_CAP_MESSAGE = `You can have up to ${FLASHCARD_LIMITS.decks} decks. Delete one you no longer need first.`;
const DECK_FULL_MESSAGE = `A deck can hold up to ${FLASHCARD_LIMITS.cardsPerDeck} cards.`;
const CARD_CAP_MESSAGE = `You can keep up to ${FLASHCARD_LIMITS.cardsPerUser} cards. Delete some you no longer need first.`;

const NO_CARDS = { cards: 0, due: 0, reviewed: 0, mastered: 0, nextDueAt: null };

// What a browser gets. Never the owner, and never the schedule's `box` or `lapses`.
const publicDeck = (deck, counts = NO_CARDS, now = new Date()) => ({
    id: String(deck._id),
    title: deck.title,
    course: deck.course,
    subject: deck.subject ? String(deck.subject) : null,
    reviewer: deck.reviewer ? String(deck.reviewer) : null,
    cards: counts.cards,
    due: counts.due,
    status: deckStatus(counts),
    nextDueDays: counts.cards > 0 && counts.due === 0 && counts.nextDueAt ? nextDueDays(counts.nextDueAt, now) : null,
    createdAt: deck.createdAt,
});

const publicCard = (card, now) => ({
    id: String(card._id),
    deckId: String(card.deck),
    term: card.term,
    answer: card.answer,
    due: isDue(card.dueAt, now),
});

// Card counts for the owner's decks (or one deck) from a single aggregate, keyed by deck id.
const countsByDeck = async (owner, now, deckId = null) => {
    const tomorrow = tomorrowStart(now);
    const countIf = (condition) => ({ $sum: { $cond: [condition, 1, 0] } });
    const rows = await flashcardModel.aggregate([
        { $match: { owner: asObjectId(owner), ...(deckId && { deck: asObjectId(deckId) }) } },
        {
            $group: {
                _id: '$deck',
                cards: { $sum: 1 },
                due: countIf({ $lt: ['$dueAt', tomorrow] }),
                reviewed: countIf({ $ne: ['$reviewedAt', null] }),
                mastered: countIf({ $gte: ['$box', MASTERED_BOX] }),
                nextDueAt: { $min: { $cond: [{ $gte: ['$dueAt', tomorrow] }, '$dueAt', null] } },
            },
        },
    ]);
    return new Map(rows.map((row) => [String(row._id), row]));
};

const publicDeckWithCounts = async (deck, now) => {
    const counts = await countsByDeck(deck.owner, now, deck._id);
    return publicDeck(deck, counts.get(String(deck._id)), now);
};

const findDeck = async (req, res) => {
    const deck = isId(req.params.deckId)
        ? await flashcardDeckModel.findOne({ _id: req.params.deckId, owner: req.userId })
        : null;
    if (!deck) notFound(res, 'Deck');
    return deck;
};

const findCard = async (req, res) => {
    const card = isId(req.params.cardId)
        ? await flashcardModel.findOne({ _id: req.params.cardId, owner: req.userId })
        : null;
    if (!card) notFound(res, 'Card');
    return card;
};

const readTitle = (value) => {
    const title = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    if (!title) return { error: 'Give the deck a title.' };
    if (title.length > FLASHCARD_LIMITS.title) return { error: `The title can be up to ${FLASHCARD_LIMITS.title} characters.` };
    return { title };
};

export const getFlashcards = async (req, res) => {
    try {
        const now = new Date();
        const owner = asObjectId(req.userId);
        const [decks, counts, sources] = await Promise.all([
            flashcardDeckModel.find({ owner }).sort({ createdAt: -1 }).lean(),
            countsByDeck(owner, now),
            // Reviewers ready to become decks. `$project` keeps the source text and the questions out.
            reviewerModel.aggregate([
                { $match: { owner, status: 'ready' } },
                { $sort: { createdAt: -1 } },
                { $project: { title: 1, course: 1, subject: 1, terms: { $size: '$keyTerms' } } },
            ]),
        ]);
        const deckForReviewer = new Map(decks.filter((deck) => deck.reviewer).map((deck) => [String(deck.reviewer), String(deck._id)]));
        const countRows = [...counts.values()];
        res.json({
            success: true,
            decks: decks.map((deck) => publicDeck(deck, counts.get(String(deck._id)), now)),
            due: {
                cards: countRows.reduce((sum, row) => sum + row.due, 0),
                decks: countRows.filter((row) => row.due > 0).length,
            },
            sources: sources.map((reviewer) => ({
                reviewerId: String(reviewer._id),
                title: reviewer.title,
                course: reviewer.course,
                subject: reviewer.subject ? String(reviewer.subject) : null,
                terms: reviewer.terms,
                deckId: deckForReviewer.get(String(reviewer._id)) ?? null,
            })),
            limits: FLASHCARD_LIMITS,
        });
    } catch (error) {
        serverError(res, 'Get flashcards error', error);
    }
};

export const createDeck = async (req, res) => {
    try {
        const body = req.body ?? {};
        const { title, error } = readTitle(body.title);
        if (error) return bad(res, error);
        const link = await resolveItemSubject(req.userId, { subject: body.subject });
        if (link.error) return bad(res, link.error);
        if (await flashcardDeckModel.countDocuments({ owner: req.userId }) >= FLASHCARD_LIMITS.decks) return bad(res, DECK_CAP_MESSAGE);

        const fields = { owner: req.userId, title };
        applyItemSubject(fields, link.subject);
        const deck = await flashcardDeckModel.create(fields);
        res.status(201).json({ success: true, deck: publicDeck(deck) });
    } catch (error) {
        serverError(res, 'Create flashcard deck error', error);
    }
};

// Cards from a reviewer's key terms: each term once (in any case), clipped to the card limits,
// skipping any that end up empty.
const cardsFromKeyTerms = (keyTerms) => {
    const seen = new Set();
    const cards = [];
    keyTerms.forEach((entry) => {
        const fields = readCardFields({
            term: entry.term?.slice(0, FLASHCARD_LIMITS.term),
            answer: entry.definition?.slice(0, FLASHCARD_LIMITS.answer),
        });
        if (fields.error) return;
        const key = fields.term.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        cards.push(fields);
    });
    return cards;
};

export const createDeckFromReviewer = async (req, res) => {
    try {
        const now = new Date();
        const { reviewerId } = req.body ?? {};
        const reviewer = isId(reviewerId)
            ? await reviewerModel.findOne({ _id: reviewerId, owner: req.userId }).select('title course subject status keyTerms').lean()
            : null;
        if (!reviewer) return notFound(res, 'Reviewer');
        if (reviewer.status !== 'ready') return bad(res, "This reviewer isn't ready yet.", 409);

        const findExisting = () => flashcardDeckModel.findOne({ owner: req.userId, reviewer: reviewer._id });
        const existing = await findExisting();
        if (existing) return res.json({ success: true, deck: await publicDeckWithCounts(existing, now), existing: true });

        const cards = cardsFromKeyTerms(reviewer.keyTerms);
        if (!cards.length) return bad(res, 'This reviewer has no key terms to turn into cards.', 422);
        if (cards.length > FLASHCARD_LIMITS.cardsPerDeck) return bad(res, DECK_FULL_MESSAGE);
        const [deckCount, cardCount] = await Promise.all([
            flashcardDeckModel.countDocuments({ owner: req.userId }),
            flashcardModel.countDocuments({ owner: req.userId }),
        ]);
        if (deckCount >= FLASHCARD_LIMITS.decks) return bad(res, DECK_CAP_MESSAGE);
        if (cardCount + cards.length > FLASHCARD_LIMITS.cardsPerUser) return bad(res, CARD_CAP_MESSAGE);

        let deck;
        try {
            deck = await flashcardDeckModel.create({
                owner: req.userId, title: reviewer.title, course: reviewer.course, subject: reviewer.subject, reviewer: reviewer._id,
            });
        } catch (error) {
            // Two requests for the same reviewer at once: the other one made the deck.
            if (error.code !== 11000) throw error;
            const winner = await findExisting();
            // The other request rolled its deck back after we lost the race.
            if (!winner) return bad(res, 'Something went wrong making the deck. Try again.', 409);
            return res.json({ success: true, deck: await publicDeckWithCounts(winner, now), existing: true });
        }

        try {
            await flashcardModel.insertMany(cards.map((card) => ({ ...card, owner: req.userId, deck: deck._id })));
        } catch (error) {
            // Drop the deck and any cards a partial insert left behind, so none count toward the cap.
            await flashcardModel.deleteMany({ deck: deck._id, owner: req.userId });
            await flashcardDeckModel.deleteOne({ _id: deck._id });
            throw error;
        }
        res.status(201).json({ success: true, deck: await publicDeckWithCounts(deck, now), added: cards.length });
    } catch (error) {
        serverError(res, 'Create deck from reviewer error', error);
    }
};

export const getReview = async (req, res) => {
    try {
        const now = new Date();
        const { deck: deckParam } = req.query;
        let deck = null;
        if (deckParam !== undefined) {
            deck = isId(deckParam) ? await flashcardDeckModel.findOne({ _id: deckParam, owner: req.userId }).lean() : null;
            if (!deck) return notFound(res, 'Deck');
        }

        const dueFilter = { owner: req.userId, ...(deck && { deck: deck._id }), dueAt: { $lt: tomorrowStart(now) } };
        const [dueCards, dueTotal] = await Promise.all([
            flashcardModel.find(dueFilter).sort({ dueAt: 1 }).limit(FLASHCARD_LIMITS.reviewBatch).select('term answer').lean(),
            flashcardModel.countDocuments(dueFilter),
        ]);

        // A named deck with nothing due is still worth going over: a practice run, where
        // "Got it" doesn't move the schedule.
        let mode = 'due';
        let cards = dueCards;
        if (deck && !dueCards.length) {
            mode = 'all';
            cards = await flashcardModel.find({ owner: req.userId, deck: deck._id }).sort({ createdAt: 1 })
                .limit(FLASHCARD_LIMITS.reviewBatch).select('term answer').lean();
        }

        res.json({
            success: true,
            mode,
            cards: shuffled(cards).map((card) => ({ id: String(card._id), term: card.term, answer: card.answer })),
            dueTotal,
            deck: deck && { id: String(deck._id), title: deck.title, course: deck.course },
        });
    } catch (error) {
        serverError(res, 'Get flashcard review error', error);
    }
};

export const getDeck = async (req, res) => {
    try {
        const now = new Date();
        const deck = await findDeck(req, res);
        if (!deck) return;
        const [publicData, cards] = await Promise.all([
            publicDeckWithCounts(deck, now),
            flashcardModel.find({ deck: deck._id, owner: req.userId }).sort({ createdAt: 1 }),
        ]);
        res.json({ success: true, deck: publicData, cards: cards.map((card) => publicCard(card, now)) });
    } catch (error) {
        serverError(res, 'Get flashcard deck error', error);
    }
};

export const updateDeck = async (req, res) => {
    try {
        const deck = await findDeck(req, res);
        if (!deck) return;
        const body = req.body ?? {};
        if (body.title !== undefined) {
            const { title, error } = readTitle(body.title);
            if (error) return bad(res, error);
            deck.title = title;
        }
        const link = await resolveItemSubject(req.userId, { subject: body.subject });
        if (link.error) return bad(res, link.error);
        applyItemSubject(deck, link.subject);
        await deck.save();
        res.json({ success: true, deck: await publicDeckWithCounts(deck, new Date()) });
    } catch (error) {
        serverError(res, 'Update flashcard deck error', error);
    }
};

export const deleteDeck = async (req, res) => {
    try {
        const deck = await findDeck(req, res);
        if (!deck) return;
        await flashcardModel.deleteMany({ deck: deck._id, owner: req.userId });
        await deck.deleteOne();
        res.json({ success: true });
    } catch (error) {
        serverError(res, 'Delete flashcard deck error', error);
    }
};

export const addCard = async (req, res) => {
    try {
        const deck = await findDeck(req, res);
        if (!deck) return;
        const fields = readCardFields(req.body ?? {});
        if (fields.error) return bad(res, fields.error);
        const [inDeck, inTotal] = await Promise.all([
            flashcardModel.countDocuments({ deck: deck._id, owner: req.userId }),
            flashcardModel.countDocuments({ owner: req.userId }),
        ]);
        if (inDeck >= FLASHCARD_LIMITS.cardsPerDeck) return bad(res, DECK_FULL_MESSAGE);
        if (inTotal >= FLASHCARD_LIMITS.cardsPerUser) return bad(res, CARD_CAP_MESSAGE);

        const card = await flashcardModel.create({ ...fields, owner: req.userId, deck: deck._id });
        res.status(201).json({ success: true, card: publicCard(card, new Date()) });
    } catch (error) {
        serverError(res, 'Add flashcard error', error);
    }
};

// Only the text can change here. The review schedule moves through rateCard alone.
export const updateCard = async (req, res) => {
    try {
        const card = await findCard(req, res);
        if (!card) return;
        const body = req.body ?? {};
        const fields = readCardFields({
            term: body.term === undefined ? card.term : body.term,
            answer: body.answer === undefined ? card.answer : body.answer,
        });
        if (fields.error) return bad(res, fields.error);
        card.set(fields);
        await card.save();
        res.json({ success: true, card: publicCard(card, new Date()) });
    } catch (error) {
        serverError(res, 'Update flashcard error', error);
    }
};

export const deleteCard = async (req, res) => {
    try {
        const removed = isId(req.params.cardId)
            ? await flashcardModel.deleteOne({ _id: req.params.cardId, owner: req.userId })
            : { deletedCount: 0 };
        if (!removed.deletedCount) return notFound(res, 'Card');
        res.json({ success: true });
    } catch (error) {
        serverError(res, 'Delete flashcard error', error);
    }
};

export const rateCard = async (req, res) => {
    try {
        const card = await findCard(req, res);
        if (!card) return;
        const now = new Date();
        const result = applyRating(card, req.body?.rating, now);
        if (!result) return bad(res, 'Pick Got it or Still learning.');
        if (result.counted) await flashcardModel.updateOne({ _id: card._id, owner: req.userId }, { $set: result.fields });
        res.json({ success: true, counted: result.counted, due: isDue(result.counted ? result.fields.dueAt : card.dueAt, now) });
    } catch (error) {
        serverError(res, 'Rate flashcard error', error);
    }
};
