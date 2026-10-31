import { useState } from "react";
import { ConfirmDialog } from "@/shared/ui";
import { deleteSubject } from "@/shared/api/subjects";

// Confirms deleting a subject. The server only unlinks its tasks and reviewers (they stay, with
// their course label), and the timetable is untouched, so the text says that. A failed delete
// keeps the dialog open with the message.
export default function DeleteSubjectDialog({ subject, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setBusy(true);
    setError("");
    const { error: failure } = await deleteSubject(subject._id);
    setBusy(false);
    if (failure) setError(failure);
    else onDeleted();
  };

  return (
    <ConfirmDialog
      open
      tone="danger"
      title={`Delete ${subject.name}?`}
      confirmLabel="Delete subject"
      busy={busy}
      onConfirm={confirm}
      onCancel={onClose}
    >
      Its tasks and reviewers stay in your lists, they just won't belong to a subject any more. Your timetable isn't changed.
      {error && <span className="study-dialog__error" role="alert"> {error}</span>}
    </ConfirmDialog>
  );
}
