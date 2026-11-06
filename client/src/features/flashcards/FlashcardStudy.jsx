import { useEffect, useRef, useState } from "react";
import { Undo2 } from "lucide-react";
import { Button, ProgressBar } from "@/shared/ui";
import "../practice/practice.css";
import "./flashcards.css";

// The Flashcards study screen (Figma 164:3499 front and 164:3558 back on desktop, 164:3541 and
// 164:3598 on a phone): a focus screen like Practice, one card at a time. Show answer flips it, then
// Still learning or Got it moves on. Nothing is scored here: `onRate(card, "learning" | "got")` just
// reports the choice, and `onFinish()` fires after the last card.
//   cards   [{ id, term, answer }], at least one
//   course, title   the deck's name, shown as "course · title"
// Render it inside the focus layout and call useFocusView(true) from the page that mounts it.
export default function FlashcardStudy({ cards, course, title, onExit, onRate, onFinish }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const showButton = useRef(null);
  const gotButton = useRef(null);
  const card = cards[index];
  const total = cards.length;

  // Esc leaves, as Exit does.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !document.querySelector('[role="dialog"]')) onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  // The button that was pressed is replaced by the next step, so focus follows to the new one.
  useEffect(() => {
    (flipped ? gotButton : showButton).current?.focus({ preventScroll: true });
  }, [flipped, index]);

  const flip = () => setFlipped((was) => !was);
  const onCardKeyDown = (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      flip();
    }
  };
  const rate = (rating) => {
    onRate?.(card, rating);
    if (index + 1 < total) {
      setIndex(index + 1);
      setFlipped(false);
    } else {
      onFinish?.();
    }
  };

  const heading = [course, title].filter(Boolean).join(" · ");
  const label = `Card ${index + 1} of ${total}`;

  return (
    <div className="practice">
      <header className="practice-top flash-top">
        <Button variant="ghost" onClick={onExit}>Exit</Button>
        <h1 className="flash-top__label">{heading || "Flashcards"}</h1>
      </header>
      <div className="practice-main">
        <div className="practice-column flash-column">
          <div className="practice-progress">
            <p className="practice-progress__text">{label}</p>
            <ProgressBar
              className="practice-progress__bar"
              value={(index + 1) / total}
              label="Flashcard progress"
              valueText={label}
            />
          </div>
          {/* Keyed by card, so the next one arrives face up without turning back first. */}
          <div
            key={card.id}
            className="flash-card practice-column--enter"
            data-flipped={flipped || undefined}
            tabIndex={0}
            role="group"
            aria-roledescription="flashcard"
            aria-label={label}
            onClick={flip}
            onKeyDown={onCardKeyDown}
          >
            <div className="flash-card__inner">
              <div className="flash-face flash-face--front" aria-hidden={flipped}>
                <p className="flash-face__tag">Term</p>
                <p className="flash-face__term">{card.term}</p>
                <p className="flash-face__hint">
                  <Undo2 size={18} aria-hidden="true" />
                  Tap the card to flip
                </p>
              </div>
              <div className="flash-face flash-face--back" aria-hidden={!flipped}>
                <p className="flash-face__tag flash-face__tag--answer">Answer</p>
                <p className="flash-face__answer">{card.answer}</p>
              </div>
            </div>
          </div>
          {flipped ? (
            <div className="flash-actions">
              <Button variant="secondary" className="flash-action" onClick={() => rate("learning")}>
                Still learning
              </Button>
              <Button ref={gotButton} className="flash-action" onClick={() => rate("got")}>
                Got it
              </Button>
            </div>
          ) : (
            <div className="flash-actions">
              <Button ref={showButton} className="flash-action" onClick={flip}>Show answer</Button>
            </div>
          )}
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {flipped ? `Answer: ${card.answer}` : `${label}. Term: ${card.term}`}
      </p>
    </div>
  );
}
