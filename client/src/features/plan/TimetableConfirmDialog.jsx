import { useState } from "react";
import { Users } from "lucide-react";
import { ConfirmDialog } from "@/shared/ui";
import { deleteTimetable, leaveTimetable } from "@/shared/api/schedules";
import "./timetable-menu.css";

const usedBy = (n, title) => `${n} ${n === 1 ? "person uses" : "people use"} ${title}. They lose it too.`;

// Delete (owner, red) or Leave (member, primary), Figma D10. Both are real: the server removes the timetable or the
// membership, and a failure keeps the dialog open with the server's message.
export default function TimetableConfirmDialog({ mode, timetable, userId, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const deleting = mode === "delete";
  const count = timetable.collaboratorCount;
  const note = deleting ? (count > 0 ? usedBy(count, timetable.title) : "") : `Everyone else keeps ${timetable.title}.`;

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
      tone={deleting ? "danger" : "default"}
      title={`${deleting ? "Delete" : "Leave"} "${timetable.title}"?`}
      confirmLabel={deleting ? "Delete timetable" : "Leave timetable"}
      busy={busy}
      onConfirm={confirm}
      onCancel={onClose}
    >
      <p className="timetable-menu__text">
        {deleting
          ? "This removes the timetable and everything on it for everyone who uses it. This can't be undone."
          : "You stop seeing it on your plan. Your own tasks and notes stay with you."}
      </p>
      {note && (
        <p className="timetable-menu__note">
          <Users size={16} aria-hidden="true" />
          {note}
        </p>
      )}
      {error && <p className="timetable-menu__error" role="alert">{error}</p>}
    </ConfirmDialog>
  );
}
