import { useCallback, useState } from "react";
import { createTask, updateTask } from "@/shared/api/tasks";
import { taskChanges, taskPayload } from "./taskForm";

// Creates a task, or with `edit` ({ task, start }: the stored task and the form it started as) updates
// it with only what changed. save() answers the saved task, the same task when nothing changed (no
// request is made), or null after a failure, when `error` holds the server's plain message and the
// dialog stays open.
export default function useSaveTask() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = useCallback(async (form, edit) => {
    let request;
    if (edit) {
      const changes = taskChanges(edit.start, form);
      if (Object.keys(changes).length === 0) return edit.task;
      request = updateTask(edit.task._id, changes);
    } else {
      request = createTask(taskPayload(form));
    }
    setSaving(true);
    setError("");
    const { data, error: failure } = await request;
    setSaving(false);
    if (failure) {
      setError(failure);
      return null;
    }
    return data.task;
  }, []);

  return { save, saving, error };
}
