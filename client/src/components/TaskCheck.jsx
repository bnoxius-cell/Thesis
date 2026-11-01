import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { DONE_SETTLE_MS, focusTargetAfter, restoreFocus } from "../utils/taskDone";

// The round done box on a task row. Ticking an open task fills the circle straight away, holds for a
// beat so the tick is seen, then asks the page to mark it done (the row leaves the list when the
// page's data updates). Un-ticking a finished task is immediate. `onChange(task, done)` should resolve
// to false when the save failed, which puts the circle back.
export default function TaskCheck({ task, onChange }) {
  const [settling, setSettling] = useState(false);
  const timer = useRef(null);
  const button = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const checked = task.isCompleted || settling;

  const press = () => {
    if (settling) return;
    // If the keyboard is here, remember where focus should go once this row leaves the list.
    const el = button.current;
    const next = el && document.activeElement === el ? focusTargetAfter(el) : undefined;
    const hadFocus = next !== undefined;
    if (task.isCompleted) {
      Promise.resolve(onChange(task, false)).then((ok) => { if (ok !== false && hadFocus) restoreFocus(next); });
      return;
    }
    setSettling(true);
    timer.current = setTimeout(async () => {
      const ok = await onChange(task, true);
      if (ok === false) setSettling(false);
      else if (hadFocus) restoreFocus(next);
    }, DONE_SETTLE_MS);
  };

  return (
    <button
      ref={button}
      type="button"
      data-task-id={task._id}
      className={`task-check${checked ? " is-checked" : ""}${settling ? " is-settling" : ""}`}
      aria-label={task.isCompleted ? `Reopen ${task.title}` : `Mark ${task.title} as done`}
      aria-pressed={checked}
      onClick={press}
    >
      <Check size={16} aria-hidden="true" />
    </button>
  );
}
