import { useLocation } from "react-router-dom";
import { Layers } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/shared/ui";
import { examChipText } from "@/features/study/subjectClasses";
import DeckRow from "./DeckRow";
import DueTodayCard from "./DueTodayCard";
import { caughtUpLine } from "./deckWords";
import "./flashcards-tab.css";

// The Flashcards side of Practice (Figma 144:826, 146:1038, FC-F1, FC-F2): the due card, or "All caught up" when
// every deck is done for today, then one row per deck. `flashcards` is useFlashcards' answer; `subjects` and
// `entries` (the timetable) only feed each row's exam chip. A deck made a moment ago eases in, and a polite live
// region says so, since there is no toast. Nothing here polls. `hideDue` leaves out the due card and the caught-up
// card (a subject's Practice tab shows only its own decks, and Start review would open every deck).
export default function FlashcardsPanel({ flashcards, subjects, entries, now, onMake, hideDue = false }) {
  const { pathname, search, hash } = useLocation();
  const from = pathname + search + hash;
  const { data, status, error, fresh, refresh } = flashcards;

  if (!data && status === "failed") {
    return (
      <EmptyState icon={Layers} title="Couldn't load your flashcards" actions={<Button variant="secondary" onClick={() => refresh()}>Try again</Button>}>
        {error}
      </EmptyState>
    );
  }
  if (!data) {
    return (
      <div className="fc-list" role="status" aria-label="Loading your flashcards">
        <Skeleton className="fc-skeleton" height="82px" />
        <Skeleton className="fc-skeleton" height="82px" />
      </div>
    );
  }

  const { decks, due } = data;
  if (decks.length === 0) {
    return (
      <EmptyState icon={Layers} title="No flashcards yet" className="fc-empty" actions={<Button onClick={onMake}>Make flashcards</Button>}>
        Turn the key terms of a reviewer into cards, or write your own.
      </EmptyState>
    );
  }

  const examFor = (deck) => {
    const subject = deck.subject && subjects.find((item) => item._id === deck.subject);
    return subject ? examChipText(entries, subject, now) : "";
  };
  const justMade = decks.find((deck) => deck.id === fresh);
  const anyCards = decks.some((deck) => deck.cards > 0);

  return (
    <div className="fc-list">
      {!hideDue && due.cards > 0 && <DueTodayCard due={due} from={from} />}
      {!hideDue && due.cards === 0 && anyCards && (
        <section className="fc-due" aria-labelledby="fc-caught-title">
          <div className="fc-due__text">
            <h2 id="fc-caught-title" className="fc-due__title">All caught up</h2>
            <p className="fc-due__line">{caughtUpLine(decks)}</p>
          </div>
        </section>
      )}
      <ul className="fc-decks stagger">
        {decks.map((deck) => (
          <DeckRow key={deck.id} deck={deck} examText={examFor(deck)} from={from} entering={deck.id === fresh} />
        ))}
      </ul>
      <p className="sr-only" role="status" aria-live="polite">
        {justMade ? `${justMade.title} made, ${justMade.cards} ${justMade.cards === 1 ? "card" : "cards"}.` : ""}
      </p>
    </div>
  );
}
