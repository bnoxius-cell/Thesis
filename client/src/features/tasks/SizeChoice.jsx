import { useId } from "react";
import { selectOnArrowKey } from "@/shared/ui/rovingKeys";
import { TASK_SIZES } from "./taskForm";

// "How big is it?" (Figma P7c): three option cards, each with its name and its hours, as one radio
// group. `value` is one of TASK_SIZES' values; the arrow keys move and select like Segment does.
export default function SizeChoice({ value, onChange, disabled = false }) {
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const index = TASK_SIZES.findIndex((size) => size.value === value);

  return (
    <div className="size-choice">
      <div className="size-choice__head">
        <span id={labelId} className="size-choice__label">How big is it?</span>
        <span id={hintId} className="size-choice__hint">A rough guess is fine. It helps spread your week.</span>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={hintId}
        className="size-choice__options"
        onKeyDown={(e) => selectOnArrowKey(e, '[role="radio"]')}
      >
        {TASK_SIZES.map((size, i) => (
          <button
            key={size.value}
            type="button"
            role="radio"
            aria-checked={i === index}
            tabIndex={i === Math.max(index, 0) ? 0 : -1}
            disabled={disabled}
            className="size-choice__option"
            onClick={() => onChange(size.value)}
          >
            <span className="size-choice__name">{size.label}</span>
            <span className="size-choice__detail">{size.detail}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
