// Sharing a flashcard deck in a group chat: the snapshot posted with the message, and the copy a groupmate
// saves from it. The snapshot holds the cards' text only, so the copy starts with a fresh review schedule.
import flashcardDeckModel, { FLASHCARD_LIMITS } from '../models/flashcardDeckModel.js';
import flashcardModel from '../models/flashcardModel.js';
import { refusal } from './httpErrors.js';
import { resolveItemSubject, subjectLabel } from './subjectMatch.js';
import { DECK_CAP_MESSAGE, CARD_CAP_MESSAGE } from './flashcardCards.js';

// `deck` is the card everyone sees; `deckContent` is only read to save a copy. Answers { error, status } for an empty deck.
export const deckSnapshot = async (deck) => {
    const cards = await flashcardModel.find({ deck: deck._id, owner: deck.owner }).sort({ createdAt: 1, _id: 1 }).select('term answer').lean();
    if (!cards.length) return refusal('Add a card to this deck before you share it.');
    return {
        deck: { title: deck.title, course: deck.course, cardCount: cards.length },
        deckContent: { cards: cards.map(({ term, answer }) => ({ term, answer })) },
    };
};

// Every piece of text a shared deck puts in front of the group, for the family-friendly filter.
export const deckTexts = ({ deck, deckContent }) => [
    deck.title, deck.course, ...deckContent.cards.flatMap((card) => [card.term, card.answer]),
];

// Saves a shared deck as the caller's own, linked to their subject of that name. Answers what was saved, null
// when they already saved it from this message, or { error } with nothing written when a limit is reached.
export const saveDeck = async (message, userId) => {
    const token = `message:${message._id}`;
    if (await flashcardDeckModel.exists({ owner: userId, copiedFrom: token })) return null;

    const { cards } = message.deckContent;
    const [deckCount, cardCount] = await Promise.all([
        flashcardDeckModel.countDocuments({ owner: userId }),
        flashcardModel.countDocuments({ owner: userId }),
    ]);
    if (deckCount >= FLASHCARD_LIMITS.decks) return refusal(DECK_CAP_MESSAGE);
    if (cardCount + cards.length > FLASHCARD_LIMITS.cardsPerUser) return refusal(CARD_CAP_MESSAGE);

    const { subject } = await resolveItemSubject(userId, { course: message.deck.course });
    let deck;
    try {
        deck = await flashcardDeckModel.create({
            owner: userId,
            title: message.deck.title,
            course: subject ? subjectLabel(subject) : message.deck.course,
            subject: subject?._id ?? null,
            copiedFrom: token,
        });
    } catch (error) {
        // The unique index on (owner, copiedFrom): a save that arrived at the same moment won.
        if (error.code === 11000) return null;
        throw error;
    }
    try {
        await flashcardModel.insertMany(cards.map((card) => ({ ...card, owner: userId, deck: deck._id })));
    } catch (error) {
        // Drop the deck and any cards a partial insert left behind, so none count toward the cap.
        await flashcardModel.deleteMany({ deck: deck._id, owner: userId });
        await flashcardDeckModel.deleteOne({ _id: deck._id });
        throw error;
    }
    return { type: 'deck', _id: deck._id, title: deck.title };
};
