// Where the flashcard screens live. The deck page (/study/flashcards/:deckId) and the review run
// (/study/flashcards/review) are built in later batches; rows and buttons already point at their real
// addresses. What the dialog and the reviewer card open after a save is the tab itself until the deck
// page exists, so that is one constant to repoint.
export const FLASHCARDS_TAB = "/study/practice?show=flashcards";

export const deckHref = (deckId) => `/study/flashcards/${deckId}`;
export const reviewHref = (deckId) => `/study/flashcards/review${deckId ? `?deck=${deckId}` : ""}`;

