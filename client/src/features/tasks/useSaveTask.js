import { useCallback, useState } from "react";
import { createTask } from "@/shared/api/tasks";
import { taskPayload } from "./taskForm";

// Creates a task. save() answers the saved task, or null after a failure, when `error` holds the
// server's plain message and the dialog stays open.
export default function useSaveTask() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = useCallback(async (form) => {
    setSaving(true);
    setError("");
    const { data, error: failure } = await createTask(taskPayload(form));
    setSaving(false);
    if (failure) {
      setError(failure);
      return null;
    }
    return data.task;
  }, []);

  return { save, saving, error };
}
