import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/shared/ui";
import { caughtUpLine, doneHeadline, doneTally, stillDueLine } from "./deckWords";
import "../practice/practice.css";
import "./flashcards.css";

// The end of a flashcard run (Figma 261:2654 and 261:2674 with some cards still learning, 261:2694 with
// all got). The tally is what the student just rated; the line under it comes from the server's counts
// after the saves settled, so it never promises more than the schedule says.
//   summary   from useFlashcardRun: { reviewed, got, learning, unsaved, stillDue, scope }
//   practice  the run was a practice run (nothing was due), so Got it left the schedule alone
//   title     the deck name shown top right, as on the study screen
//   backLabel "Back to Practice" or "Back to deck"; onBack goes there, and Exit does the same
//   onAgain   starts a new run over the cards still due
export default function FlashcardDone({ summary, practice, title, backLabel, onBack, onAgain }) {
  const { reviewed, got, learning, unsaved, stillDue, scope } = summary;
  const heading = useRef(null);
  const [announce, setAnnounce] = useState("");
  const tally = doneTally(got, learning);
  const next = stillDue > 0 ? stillDueLine(stillDue) : scope ? caughtUpLine(scope) : "";

  // Focus the heading once so the result is read out; the tally is announced once, after it has mounted.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    setAnnounce([tally, next].filter(Boolean).join(". "));
  }, [tally, next]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !document.querySelector('[role="dialog"]')) onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  return (
    <div className="practice">
      <header className="practice-top flash-top flash-top--done">
        <Button variant="ghost" onClick={onBack}>Exit</Button>
        {title && <p className="flash-top__label">{title}</p>}
      </header>
      <div className="practice-main">
        <div className="practice-column practice-column--enter flash-done">
          <div className="flash-done__body">
            <span className="flash-done__badge" aria-hidden="true">
              <Check size={28} />
            </span>
            <p className="practice-eyebrow">{practice ? "Practice run" : "Today's review"}</p>
            <h1 ref={heading} tabIndex={-1} className="practice-title">
              {doneHeadline(reviewed, practice)}
            </h1>
            <p className="flash-done__tally">{tally}</p>
            {next && <p className="practice-lead">{next}</p>}
            {practice && !stillDue && <p className="practice-lead">Nothing was due, so your schedule stays the same.</p>}
            {unsaved > 0 && (
              <p className="flash-done__unsaved">
                Some answers didn't save, so those cards may come back sooner than planned.
              </p>
            )}
          </div>
          <div className="flash-done__actions">
            {stillDue > 0 ? (
              <>
                <Button onClick={onAgain}>Go over the {stillDue} again</Button>
                <Button variant="secondary" onClick={onBack}>{backLabel}</Button>
              </>
            ) : (
              <Button onClick={onBack}>{backLabel}</Button>
            )}
          </div>
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
    </div>
  );
}
