import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { suggestMoves } from "./suggestions";
import { fromISODate } from "./scheduleUtils";

export const shortDate = (iso) => fromISODate(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

// Ideas for lightening a week that doesn't fit. Each one is a due date the student could move,
// worked out from the week's plan. Nothing changes until they tap "Move it". "Not now" hides an
// idea until tomorrow (kept in localStorage, per user).
export function useMoveSuggestions({ userId, tasks, fixedTasks, profile, overview, strained, now }) {
  const storageKey = `dismissedMoves:${userId || "anonymous"}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return Object.fromEntries(Object.entries(saved).filter(([, until]) => until > Date.now()));
    } catch {
      return {};
    }
  });

  // The inputs are rebuilt on every render, so key the memo on their values (and the minute).
  const inputsKey = JSON.stringify([
    tasks.map((t) => [t._id, t.dueDate, t.hours, t.importance, t.difficulty]), fixedTasks, profile, overview, strained, Math.floor(now / 60000),
  ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const suggestions = useMemo(() => suggestMoves({ tasks, fixedTasks, profile, overview, strained, now }), [inputsKey]);
  const visible = suggestions.filter((sug) => !dismissed[`${sug.taskId}:${sug.toDate}`]);

  const dismiss = (sug) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const next = { ...dismissed, [`${sug.taskId}:${sug.toDate}`]: tomorrow.getTime() };
    setDismissed(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* private mode */ }
  };

  return { visible, dismiss };
}

// Moves a due date the student agreed to, and offers an undo since it changes their plan. The
// undo toast only appears when the move actually saved.
export async function applyMove(sug, updateTask) {
  const saved = await updateTask(sug.taskId, { dueDate: sug.toDate });
  if (!saved) return;
  toast.info(({ closeToast }) => (
    <div>
      Moved "{sug.title}" to {shortDate(sug.toDate)}.{" "}
      <button
        type="button"
        className="toast-undo"
        onClick={() => { updateTask(sug.taskId, { dueDate: sug.fromDate }); closeToast(); }}
      >
        Undo
      </button>
    </div>
  ));
}
