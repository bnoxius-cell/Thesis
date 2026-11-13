import { useState } from "react";
import { ConfirmDialog } from "@/shared/ui";
import { deleteTask } from "@/shared/api/tasks";
import "./task-dialog.css";

// Confirms deleting a task (Figma 211:2895, phone sheet 211:3007). A failed delete keeps the dialog
// open with the server's message. `onDeleted` runs after the server says it is gone.
export default function DeleteTaskDialog({ task, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setBusy(true);
    setError("");
    const { error: failure } = await deleteTask(task._id);
    setBusy(false);
    if (failure) setError(failure);
    else onDeleted();
  };

  return (
    <ConfirmDialog
      open
      sheet
      className="task-delete"
      tone="danger"
      title={`Delete "${task.title}"?`}
      confirmLabel="Delete task"
      busy={busy}
      onConfirm={confirm}
      onCancel={onClose}
    >
      It leaves your plan and your task list, notes included. This can't be undone.
      {error && <span className="task-dialog__error" role="alert"> {error}</span>}
    </ConfirmDialog>
  );
}
