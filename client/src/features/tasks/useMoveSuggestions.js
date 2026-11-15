import { useCallback, useMemo, useState } from "react";
import { fromISODate, toISODate } from "@/utils/scheduleUtils";
import { suggestMoves } from "@/utils/suggestions";

const storageKey = (userId) => `stresscare:dismissed-moves:${userId || "anonymous"}`;

// "Not now" hides an idea until tomorrow. Kept in this browser, per student; expired entries are dropped.
function readDismissed(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(userId)) || "{}");
    return Object.fromEntries(Object.entries(saved).filter(([, until]) => until > Date.now()));
  } catch {
    return {};
  }
}

function writeDismissed(userId, dismissed) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(dismissed));
  } catch {
    // Not now just won't stick.
  }
}

// Ideas for lightening a week that doesn't fit: each is a task the student could start earlier. Due dates
// never change here; "Open task" shows the task so they can plan it.
//   visible          the ideas not dismissed today, best first
//   openerFor(idea)  a function that opens the idea's task window, or null when the task isn't in the list
//   dismiss(idea)    hides the idea until tomorrow
export default function useMoveSuggestions({ userId, tasks, onOpenTask, fixedTasks, profile, overview, strained, now }) {
  const [dismissed, setDismissed] = useState(() => readDismissed(userId));

  // The ideas only depend on the day, so a clock tick doesn't redo the search.
  const day = toISODate(now);
  const suggestions = useMemo(
    () => suggestMoves({ tasks, fixedTasks, profile, overview, strained, now: fromISODate(day) }),
    [tasks, fixedTasks, profile, overview, strained, day],
  );
  const visible = suggestions.filter((idea) => !dismissed[`${idea.taskId}:${idea.doOn}`]);

  const openerFor = useCallback((idea) => {
    const task = tasks.find((t) => t._id === idea.taskId);
    return task ? () => onOpenTask(task) : null;
  }, [tasks, onOpenTask]);

  const dismiss = useCallback((idea) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const next = { ...dismissed, [`${idea.taskId}:${idea.doOn}`]: tomorrow.getTime() };
    setDismissed(next);
    writeDismissed(userId, next);
  }, [dismissed, userId]);

  return { visible, openerFor, dismiss };
}
