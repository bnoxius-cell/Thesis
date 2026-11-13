import { useState } from "react";
import { Users } from "lucide-react";
import { ConfirmDialog } from "@/shared/ui";
import { deleteEntry } from "@/shared/api/schedules";
import { KIND_LABELS, WEEKDAYS } from "@/utils/scheduleUtils";
import "./entry-form.css";

// "Tuesday and Thursday", "Monday, Wednesday and Friday" from Date#getDay numbers, Monday first.
const dayList = (days) => {
  const names = WEEKDAYS.filter((day) => days.includes(day.value)).map((day) => day.long);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
};

// Confirms deleting a class, exam, event or activity (Figma D5: weekly class 211:3239, shared 211:3583, phone
// sheets 211:3351 and 211:3702). `entry` is the stored entry and `timetable` the one it is on (`live` adds the
// line that everyone on it sees the change). `subject` is the entry's subject, when it has one, which stays.
// A failed delete keeps the dialog open with the server's message; an entry that is already gone calls
// `onGone`. `onDeleted` runs after the server says it is gone.
export default function DeleteEntryDialog({ entry, timetable, subject, onClose, onDeleted, onGone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const noun = KIND_LABELS[entry.kind].toLowerCase();
  const weekly = entry.days?.length > 0 && !entry.date;

  const confirm = async () => {
    setBusy(true);
    setError("");
    const result = await deleteEntry(timetable._id, entry._id);
    setBusy(false);
    if (result.error) {
      if (result.status === 404 && result.fromApi) onGone();
      else setError(result.error);
    } else {
      onDeleted();
    }
  };

  const stays = subject ? `Your ${subject.name} subject, tasks and reviewers stay. ` : "";
  const what = weekly
    ? `This removes the ${noun} from every ${dayList(entry.days)} on ${timetable.title}. `
    : `This removes the ${noun} from ${timetable.title}. `;

  return (
    <ConfirmDialog
      open
      sheet
      className="entry-delete"
      tone="danger"
      title={`Delete "${entry.title}"?`}
      confirmLabel={`Delete ${noun}`}
      busy={busy}
      onConfirm={confirm}
      onCancel={onClose}
    >
      {what}{stays}This can't be undone.
      {timetable.live && (
        <span className="entry-dialog__shared entry-delete__shared">
          <Users size={18} aria-hidden="true" />
          Everyone on {timetable.title} sees this change.
        </span>
      )}
      {error && <span className="entry-dialog__error" role="alert"> {error}</span>}
    </ConfirmDialog>
  );
}
