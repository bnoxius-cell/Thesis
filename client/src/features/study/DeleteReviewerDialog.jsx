import { useState } from "react";
import { ConfirmDialog } from "@/shared/ui";
import { deleteReviewer } from "@/shared/api/reviewers";
import "./reviewer.css";

// Confirms deleting a reviewer. A failed delete keeps the dialog open with the server's message.
export default function DeleteReviewerDialog({ reviewer, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setBusy(true);
    setError("");
    const { error: failure } = await deleteReviewer(reviewer._id);
    setBusy(false);
    if (failure) setError(failure);
    else onDeleted();
  };

  return (
    <ConfirmDialog
      open
      tone="danger"
      title="Delete this reviewer?"
      confirmLabel="Delete reviewer"
      busy={busy}
      onConfirm={confirm}
      onCancel={onClose}
    >
      <strong>{reviewer.title}</strong> and your scores on it will be deleted. This can't be undone.
      {error && <span className="reviewer-dialog-error" role="alert"> {error}</span>}
    </ConfirmDialog>
  );
}
