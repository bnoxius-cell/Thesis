import { del, get, patch, post } from "./http";

// Every call answers { data } or { error } (see http.js). Routes are mounted at /api/flashcards.
const BASE = "/api/flashcards";

// The Flashcards tab in one answer: { decks, due: { cards, decks }, sources, limits }.
// `decks` are { id, title, course, subject, reviewer, cards, due, status ("new" | "learning" | "mastered"),
// nextDueDays, createdAt }, newest first. `sources` are the ready reviewers a deck can be made from:
// { reviewerId, title, course, subject, terms, deckId } (deckId when one already exists). `limits` is
// { decks, cardsPerDeck, cardsPerUser, title, term, answer, reviewBatch }.
export const fetchFlashcards = () => get(BASE);

// A deck of the student's own: { title, subject? } (subject is a subject id). Answers { deck }.
export const createDeck = (body) => post(`${BASE}/decks`, body);

// A deck from a reviewer's key terms. A new deck answers { deck, added }; one that already exists
// answers { deck, existing: true } with nothing added.
export const createDeckFromReviewer = (reviewerId) => post(`${BASE}/decks/from-reviewer`, { reviewerId });

// The cards due now, optionally for one deck (a run is at most `limits.reviewBatch` cards).
export const fetchReview = (deckId) => get(`${BASE}/review${deckId ? `?deck=${encodeURIComponent(deckId)}` : ""}`);

export const fetchDeck = (deckId) => get(`${BASE}/decks/${deckId}`);
export const updateDeck = (deckId, body) => patch(`${BASE}/decks/${deckId}`, body);
export const deleteDeck = (deckId) => del(`${BASE}/decks/${deckId}`);

export const addCard = (deckId, body) => post(`${BASE}/decks/${deckId}/cards`, body);
export const updateCard = (cardId, body) => patch(`${BASE}/cards/${cardId}`, body);
export const deleteCard = (cardId) => del(`${BASE}/cards/${cardId}`);

// `rating` is "got" (Got it) or "learning" (Still learning); the server checks the word.
export const rateCard = (cardId, rating) => post(`${BASE}/cards/${cardId}/rate`, { rating });
