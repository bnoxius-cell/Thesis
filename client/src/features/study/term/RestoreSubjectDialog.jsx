import { useState } from "react";
import { ConfirmDialog } from "@/shared/ui";
import { restoreSubject } from "@/shared/api/subjects";
import { plural } from "@/shared/lib/plural";

// Confirms bringing an archived subject back. Its tasks, reviewers, decks and files never left it; the class times
// kept on it return to the main timetable. A refusal (a same-name active subject, the subject cap) keeps the
// dialog open with the server's message. `onRestored` gets the server's answer.
export default function RestoreSubjectDialog({ subject, onClose, onRestored }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const times = subject.pastClassTimes?.length ?? 0;

  const confirm = async () => {
    setBusy(true);
    setError("");
    const { data, error: failure } = await restoreSubject(subject._id);
    setBusy(false);
    if (failure) setError(failure);
    else onRestored(data);
  };

  return (
    <ConfirmDialog
      open
      sheet
      title={`Restore "${subject.name}"?`}
      confirmLabel="Restore subject"
      busy={busy}
      onConfirm={confirm}
      onCancel={onClose}
    >
      {times > 0
        ? `It goes back to your active subjects, and its ${plural(times, "class time")} ${times === 1 ? "returns" : "return"} to your main timetable.`
        : "It goes back to your active subjects."}
      {error && <span className="study-dialog__error" role="alert"> {error}</span>}
    </ConfirmDialog>
  );
}
