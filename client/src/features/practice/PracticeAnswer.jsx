import { Check } from "lucide-react";

const TAG = { correct: "Correct", yours: "Your answer" };

// One answer row (Figma 76:853, selected 76:859, graded 77:468 and 77:471). `state` is how it looks:
// idle | selected | correct (the right answer, good) | yours (the student's wrong pick, watch: a
// wrong answer is never red). `checked` says the student picked it. A radio in a radiogroup, so the
// arrow keys move and select (on the group) and only one row is in the tab order.
export default function PracticeAnswer({ label, state, checked, focusable, locked, onPick }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      tabIndex={focusable ? 0 : -1}
      disabled={locked}
      className={`practice-answer practice-answer--${state}`}
      onClick={onPick}
    >
      <span className="practice-answer__radio" aria-hidden="true" />
      <span className="practice-answer__label">{label}</span>
      {TAG[state] && <span className="practice-answer__tag">{TAG[state]}</span>}
      {(state === "selected" || state === "correct") && (
        <Check className="practice-answer__check" size={20} aria-hidden="true" />
      )}
    </button>
  );
}
