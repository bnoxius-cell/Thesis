import { Button } from "@/shared/ui";
import { dueLine, dueTitle } from "./deckWords";
import { reviewHref } from "./flashcardLinks";

// The card at the top of the tab (Figma 144:826, 146:1038): how many cards are due and a way to start. The
// button opens a review of every deck that has cards due; `from` is the address the run's Back returns to.
export default function DueTodayCard({ due, from }) {
  return (
    <section className="fc-due" aria-labelledby="fc-due-title">
      <div className="fc-due__text">
        <h2 id="fc-due-title" className="fc-due__title">{dueTitle(due.cards)}</h2>
        <p className="fc-due__line">{dueLine(due.decks, due.cards)}</p>
      </div>
      <Button className="fc-due__start" to={reviewHref()} state={{ from }}>Start review</Button>
    </section>
  );
}
