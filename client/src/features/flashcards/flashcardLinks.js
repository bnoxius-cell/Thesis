// Where the flashcard screens live: the Flashcards side of Practice, one deck's page and the review run.
export const FLASHCARDS_TAB = "/study/practice?show=flashcards";

export const deckHref = (deckId) => `/study/flashcards/${deckId}`;
export const reviewHref = (deckId) => `/study/flashcards/review${deckId ? `?deck=${deckId}` : ""}`;

// Where a saved Make flashcards dialog goes: a deck of your own or one that already existed opens its page; a
// deck made from a reviewer's key terms (the server says how many cards it `added`) stays on the tab.
export const opensDeckPage = (result) => result.added === undefined || Boolean(result.existing);
