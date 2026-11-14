import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/shared/ui";

// One Get started step (Figma ChecklistRow 315:47): a tick, the label and hint, and one button that does
// the step in place. A done row has no button; a screen reader hears "(done)" after the label.
// `onAdd(kind)` opens the global Add. The tick pops only when this row turns done while it is on
// screen, never on mount or on a reload that changes nothing.
export default function ChecklistRow({ step, done, onAdd }) {
  const [wasDone, setWasDone] = useState(done);
  const [popping, setPopping] = useState(false);
  if (done !== wasDone) {
    setWasDone(done);
    setPopping(done);
  }

  const { label, hint, cta, action } = step;
  return (
    <li className="checklist-row" data-done={done || undefined}>
      <span className="checklist-row__tick" data-popping={popping || undefined} aria-hidden="true">
        {done && <Check size={16} />}
      </span>
      <div className="checklist-row__text">
        <span className="checklist-row__label">
          {label}
          {done && <span className="sr-only"> (done)</span>}
        </span>
        <span className="checklist-row__hint">{hint}</span>
      </div>
      {!done && (
        <Button
          variant="secondary"
          className="checklist-row__button"
          {...(action.add ? { onClick: () => onAdd(action.add) } : { to: action.to, state: { from: "/home" } })}
        >
          {cta}
        </Button>
      )}
    </li>
  );
}
