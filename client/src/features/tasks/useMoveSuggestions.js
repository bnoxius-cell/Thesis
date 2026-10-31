import { useCallback, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { updateTask } from "@/shared/api/tasks";
import { shortDate } from "@/shared/lib/dates";
import { fromISODate, toISODate } from "@/utils/scheduleUtils";
import { suggestMoves } from "@/utils/suggestions";
import { showUndoToast } from "./doneToast";

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

// Ideas for lightening a week that doesn't fit: each is a due date the student could move. Nothing changes
// until they tap "Move it", which saves the new date and offers Undo.
//   visible          the ideas not dismissed today, best first
//   move(idea)       saves the new date into the list that `setTasks` owns
//   dismiss(idea)    hides the idea until tomorrow
//   moving           true while a move is saving
export default function useMoveSuggestions({ userId, tasks, setTasks, fixedTasks, profile, overview, strained, now }) {
  const [dismissed, setDismissed] = useState(() => readDismissed(userId));
  const [moving, setMoving] = useState(false);

  // The ideas only depend on the day, so a clock tick doesn't redo the search.
  const day = toISODate(now);
  const suggestions = useMemo(
    () => suggestMoves({ tasks, fixedTasks, profile, overview, strained, now: fromISODate(day) }),
    [tasks, fixedTasks, profile, overview, strained, day],
  );
  const visible = suggestions.filter((idea) => !dismissed[`${idea.taskId}:${idea.toDate}`]);

  const save = useCallback(async (idea, dueDate) => {
    const { data, error } = await updateTask(idea.taskId, { dueDate });
    if (error) {
      toast.error(error);
      return false;
    }
    setTasks((list) => list.map((task) => (task._id === data.task._id ? data.task : task)));
    return true;
  }, [setTasks]);

  const move = useCallback(async (idea) => {
    setMoving(true);
    const saved = await save(idea, idea.toDate);
    setMoving(false);
    if (saved) showUndoToast(`Moved "${idea.title}" to ${shortDate(idea.toDate)}.`, () => save(idea, idea.fromDate));
  }, [save]);

  const dismiss = useCallback((idea) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const next = { ...dismissed, [`${idea.taskId}:${idea.toDate}`]: tomorrow.getTime() };
    setDismissed(next);
    writeDismissed(userId, next);
  }, [dismissed, userId]);

  return { visible, move, dismiss, moving };
}
