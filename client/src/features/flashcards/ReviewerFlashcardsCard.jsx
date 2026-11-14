import { Button, Card } from "@/shared/ui";
import { FLASHCARDS_TAB } from "./flashcardLinks";
import useReviewerDeck from "./useReviewerDeck";
import "./flashcards-tab.css";

// The Flashcards card on a reviewer's side panel (Figma 262:1910, 262:2067): the key terms found in this
// reviewer and one button to turn them into a deck. With a deck it says so and opens the Flashcards tab.
// Reuses the side panel's card classes. `terms` is the reviewer's key term count; none, no card.
export default function ReviewerFlashcardsCard({ reviewerId, terms }) {
  const { hasDeck, busy, error, make } = useReviewerDeck(reviewerId);
  if (terms < 1) return null;

  return (
    <Card as="section" className="reviewer-card" aria-labelledby="reviewer-flashcards-title">
      <h2 id="reviewer-flashcards-title" className="reviewer-card__title">Flashcards</h2>
      <p className="reviewer-card__line" role="status">
        {hasDeck
          ? "This reviewer has a flashcard deck."
          : `${terms} key ${terms === 1 ? "term" : "terms"} found in this reviewer`}
      </p>
      {hasDeck ? (
        <Button variant="secondary" className="reviewer-card__action" to={FLASHCARDS_TAB}>Open flashcards</Button>
      ) : (
        <Button className="reviewer-card__action" onClick={make} busy={busy}>Make flashcards</Button>
      )}
      {error && <p className="fc-card__error" role="alert">{error}</p>}
    </Card>
  );
}
