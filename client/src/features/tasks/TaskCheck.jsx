import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import "./tasks.css";

// How long a ticked box shows its filled state before the row is asked to leave, so the tick is seen.
const SETTLE_MS = 280;

// Where keyboard focus should go once this box's row leaves the list: the next row's box, else the
// one above, else the page, so focus never drops to <body>.
function focusTargetAfter(button) {
  const row = button.closest("li");
  const boxOf = (li) => li?.querySelector(".tasks-check");
  return boxOf(row?.nextElementSibling) || boxOf(row?.previousElementSibling) || document.getElementById("main");
}

// The round done box on a task row, with a 44px hit area. Ticking an open task fills it, holds for a
// beat, then calls onChange(task, true). Unticking is immediate. onChange should resolve to false when
// the save failed, which puts the circle back.
export default function TaskCheck({ task, onChange }) {
  const [settling, setSettling] = useState(false);
  const timer = useRef(null);
  const button = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const checked = task.isCompleted || settling;

  const press = () => {
    if (settling) return;
    const keyboard = document.activeElement === button.current;
    const next = keyboard ? focusTargetAfter(button.current) : null;
    const moveFocus = () => next && requestAnimationFrame(() => next.isConnected && next.focus({ preventScroll: true }));

    if (task.isCompleted) {
      onChange(task, false);
      return;
    }
    setSettling(true);
    timer.current = setTimeout(async () => {
      const ok = await onChange(task, true);
      if (ok === false) setSettling(false);
      else moveFocus();
    }, SETTLE_MS);
  };

  return (
    <button
      ref={button}
      type="button"
      className={`tasks-check${checked ? " is-checked" : ""}${settling ? " is-settling" : ""}`}
      aria-label={task.isCompleted ? `Reopen ${task.title}` : `Mark ${task.title} as done`}
      aria-pressed={checked}
      onClick={press}
    >
      <Check size={16} aria-hidden="true" />
    </button>
  );
}
