// The words of the Flashcards tab (plan 33, section 3.2). Pure, so every sentence is in one place.

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// A card takes about half a minute, so a run of n cards is about n / 2 minutes.
export const reviewMinutes = (cards) => Math.max(1, Math.ceil(cards / 2));

// "14 cards due today" / "1 card due today"
export const dueTitle = (cards) => `${plural(cards, "card")} due today`;

// "Across 2 decks · about 7 minutes"
export const dueLine = (decks, cards) => `Across ${plural(decks, "deck")} · about ${plural(reviewMinutes(cards), "minute")}`;

const nextWords = (days) => (days === 1 ? "due tomorrow" : `due in ${days} days`);

// "24 cards · 6 due today", "12 cards · due tomorrow", "30 cards · all caught up" or "No cards yet".
export function deckMeta(deck) {
  if (deck.cards === 0) return "No cards yet";
  const count = plural(deck.cards, "card");
  if (deck.due > 0) return `${count} · ${deck.due} due today`;
  return `${count} · ${deck.nextDueDays > 0 ? nextWords(deck.nextDueDays) : "all caught up"}`;
}

const STATUS_CHIPS = {
  new: { tone: "neutral", label: "New" },
  learning: { tone: "accent", label: "Learning" },
  mastered: { tone: "good", label: "Mastered" },
};

// One chip per deck: an exam within two weeks wins (`examText`, "" when there is none), else its status.
export const deckChip = (deck, examText) => (examText ? { tone: "watch", label: examText } : STATUS_CHIPS[deck.status] ?? STATUS_CHIPS.new);

// The line under "All caught up": when the soonest cards come back.
export function caughtUpLine(decks) {
  const days = decks.map((deck) => deck.nextDueDays).filter((n) => n > 0);
  if (days.length === 0) return "Nothing is waiting for you.";
  const soonest = Math.min(...days);
  return `Your next cards are ${nextWords(soonest)}.`;
}

// "18 key terms" / "1 key term", the line under a reviewer in the dialog.
export const termsLine = (terms) => (terms > 0 ? plural(terms, "key term") : "No key terms");
