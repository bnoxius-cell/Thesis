import { useEffect, useRef } from "react";
import { Button, ProgressBar } from "@/shared/ui";
import { selectOnArrowKey } from "@/shared/ui/rovingKeys";
import CheckInAnswer from "./CheckInAnswer";

// One question per screen (Figma 54:581). The question is the page heading and names the radiogroup.
// Arrows choose an answer, Enter moves on, and focus starts on the answers so that works at once.
export default function CheckInQuestion({ questionnaire, step, count, picked, saving, error, onPick, onNext, onBack }) {
  const { stem, questions, answers } = questionnaire;
  const group = useRef(null);
  const tabIndexOf = answers.findIndex((a) => a.value === picked);
  const last = step === count - 1;

  useEffect(() => {
    group.current?.querySelector('[tabindex="0"]')?.focus({ preventScroll: true });
  }, [step]);

  const onKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault(); // the focused row would otherwise just pick itself again
      if (picked !== null) onNext();
      return;
    }
    selectOnArrowKey(event, '[role="radio"]');
  };

  return (
    <div className="checkin-column">
      <div className="checkin-progress">
        <p className="checkin-progress__text">Question {step + 1} of {count}</p>
        <ProgressBar
          className="checkin-progress__bar"
          value={(step + 1) / count}
          label="Check-in progress"
          valueText={`Question ${step + 1} of ${count}`}
        />
      </div>
      {/* Only this part is keyed, so the progress bar keeps its fill and eases to the next value. */}
      <div key={step} className="checkin-column checkin-column--enter">
        <h1 id="checkin-question" className="checkin-title">{`${stem} ${questions[step]}`}</h1>
        <div
          ref={group}
          role="radiogroup"
          aria-labelledby="checkin-question"
          className="checkin-answers"
          onKeyDown={onKeyDown}
        >
          {answers.map((answer, i) => (
            <CheckInAnswer
              key={answer.value}
              label={answer.label}
              selected={answer.value === picked}
              focusable={i === Math.max(tabIndexOf, 0)}
              onPick={() => onPick(answer.value)}
            />
          ))}
        </div>
        {error && <p className="checkin-error" role="alert">{error}</p>}
        <div className="checkin-nav">
          <Button variant="secondary" disabled={saving} onClick={onBack}>Back</Button>
          <Button busy={saving} disabled={picked === null} onClick={onNext}>
            {last ? "See my result" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
