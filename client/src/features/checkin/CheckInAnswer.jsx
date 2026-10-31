import { Check } from "lucide-react";

// One answer row (Figma 54:595, selected 54:601). A radio in a radiogroup, so the arrow keys move
// and select (selectOnArrowKey, on the group) and only the selected row, or the first when none is
// picked, is in the tab order. The row is at least 56px high, well over the 44px tap target.
export default function CheckInAnswer({ label, selected, focusable, onPick }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={focusable ? 0 : -1}
      className="checkin-answer"
      onClick={onPick}
    >
      <span className="checkin-answer__radio" aria-hidden="true" />
      <span className="checkin-answer__label">{label}</span>
      {selected && <Check className="checkin-answer__check" size={20} aria-hidden="true" />}
    </button>
  );
}
