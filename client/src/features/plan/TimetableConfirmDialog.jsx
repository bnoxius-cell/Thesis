import { useState } from "react";
import { ConfirmDialog } from "@/shared/ui";
import { deleteTimetable, leaveTimetable } from "@/shared/api/schedules";
import "./timetable-menu.css";

const people = (n) => `${n} ${n === 1 ? "person uses" : "people use"}`;

// Delete (owner) or Leave (member), Figma D10. Both are real: the server removes the timetable or the
// membership, and a failure keeps the dialog open with the server's message.
export default function TimetableConfirmDialog({ mode, timetable, userId, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const deleting = mode === "delete";

  const confirm = async () => {
    setBusy(true);
    setError("");
    const { error: failure } = deleting ? await deleteTimetable(timetable._id) : await leaveTimetable(timetable._id, userId);
    setBusy(false);
    if (failure) setError(failure);
    else onDone();
  };

  return (
    <ConfirmDialog
      open
      sheet
      tone="danger"
      title={`${deleting ? "Delete" : "Leave"} "${timetable.title}"?`}
      confirmLabel={deleting ? "Delete timetable" : "Leave timetable"}
      busy={busy}
      onConfirm={confirm}
      onCancel={onClose}
    >
      {deleting ? (
        <>
          The timetable and everything on it are removed for good.
          {timetable.collaboratorCount > 0 && ` ${people(timetable.collaboratorCount)} it. They lose it too.`}
        </>
      ) : (
        <>You stop seeing it on your plan. Your own tasks and notes stay with you. Everyone else keeps it.</>
      )}
      {error && <span className="timetable-menu__error" role="alert"> {error}</span>}
    </ConfirmDialog>
  );
}
