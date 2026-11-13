import { useEffect, useId, useRef } from "react";
import { Check } from "lucide-react";
import PracticeAnswerNote from "./PracticeAnswerNote";
import "./practice-answers.css";

// The answer box for identification and fill in the blank (Figma QT-F6, QT-F7). Enter checks. Once
// graded it is read-only: the student's text stays, in good when right (with "Correct") or in watch
// when not, and the answer is shown under it. Never red.
export default function PracticeTypedAnswer({ value, onChange, onSubmit, result }) {
  const id = useId();
  const input = useRef(null);
  const tone = result ? (result.correct ? "good" : "watch") : "idle";

  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);

  const onKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className="practice-typed">
      <label htmlFor={id} className="practice-typed__label">Your answer</label>
      <div className={`practice-input practice-input--${tone}`}>
        <input
          ref={input}
          id={id}
          className="practice-input__control"
          type="text"
          value={result ? result.text : value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          readOnly={Boolean(result)}
          maxLength={200}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-describedby={result ? undefined : `${id}-hint`}
        />
        {result?.correct && (
          <>
            <span className="practice-input__tag">Correct</span>
            <Check className="practice-input__check" size={20} aria-hidden="true" />
          </>
        )}
      </div>
      {!result && <p id={`${id}-hint`} className="practice-hint">Capital letters and spaces don't matter.</p>}
      {result && !result.correct && <PracticeAnswerNote>Answer: {result.answer}</PracticeAnswerNote>}
    </div>
  );
}
