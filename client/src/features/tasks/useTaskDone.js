import { useCallback } from "react";
import { toast } from "react-toastify";
import { updateTask } from "@/shared/api/tasks";
import { showDoneToast, showReopenedToast } from "./doneToast";

// Ticking a task off (or back on) for a list that lives in state. `setTasks` is the list's setter.
// The change shows at once and is rolled back with a plain message if the server says no.
// Returns setDone(task, done), which resolves to true when it saved and false when it did not.
export default function useTaskDone(setTasks) {
  const setDone = useCallback(async (task, done) => {
    const replace = (next) => setTasks((list) => list.map((t) => (t._id === task._id ? next : t)));
    replace({ ...task, isCompleted: done, completedAt: done ? new Date().toISOString() : null });

    const { data, error } = await updateTask(task._id, { isCompleted: done });
    if (error) {
      replace(task);
      toast.error(error);
      return false;
    }
    replace(data.task);
    if (done) showDoneToast(() => setDone(task, false));
    else showReopenedToast();
    return true;
  }, [setTasks]);

  return setDone;
}
