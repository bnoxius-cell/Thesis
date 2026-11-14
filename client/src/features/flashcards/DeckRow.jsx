import { Link } from "react-router-dom";
import { Layers } from "lucide-react";
import { Chip } from "@/shared/ui";
import { deckChip, deckMeta } from "./deckWords";
import { deckHref, reviewHref } from "./flashcardLinks";

// One deck (Figma 144:826, 146:1038). The title is a stretched link to the deck page, so the whole row opens
// it; "Study" (desktop) starts a review of just this deck. The subject chip and "Study" are desktop only, the
// phone row keeps the status chip. `examText` is "Exam in 9 days" when an exam of the deck's subject is close.
// `entering` eases the row in after a save.
export default function DeckRow({ deck, examText, from, entering }) {
  const chip = deckChip(deck, examText);

  return (
    <li className={`fc-deck${entering ? " is-entering" : ""}`}>
      <div className="fc-deck__text">
        <h3 className="fc-deck__title">
          <Link to={deckHref(deck.id)} state={{ from }} className="fc-deck__link">{deck.title}</Link>
        </h3>
        <p className="fc-deck__meta">{deckMeta(deck)}</p>
      </div>
      <div className="fc-deck__side">
        {deck.course && <Chip tone="neutral" className="fc-deck__subject">{deck.course}</Chip>}
        <Chip tone={chip.tone}>{chip.label}</Chip>
        {deck.cards > 0 && (
          <Link to={reviewHref(deck.id)} state={{ from }} className="fc-deck__study" aria-label={`Study ${deck.title}`}>
            Study
          </Link>
        )}
        <Layers className="fc-deck__icon" size={20} aria-hidden="true" />
      </div>
    </li>
  );
}
