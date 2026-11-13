import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { fetchTimetable, isTimetableGone } from "@/shared/api/schedules";
import { KIND_LABELS } from "@/utils/scheduleUtils";
import DeleteEntryDialog from "./DeleteEntryDialog";
import EntryFormDialog from "./EntryFormDialog";

const TIMETABLE_GONE = "That timetable isn't available anymore. It may have been deleted or is no longer shared with you.";

const labelOf = (kind) => KIND_LABELS[kind];

// Edit and delete for classes, exams, events and activities, wired to the details window (plan 25 C5, R4, R5,
// R10).
//   const edit = useEntryEdit({ subjects, onChanged });
//   useItemDetail({ ..., onEditEntry: edit.onEditEntry, onDeleteEntry: edit.onDeleteEntry }), then {edit.dialog}.
// The week overview's entries leave out image, colour and the term dates, and don't say whether the timetable
// is shared, so Edit and Delete first read the timetable the entry lives on and use the stored entry from it
// (the form sends it back whole, so nothing the form doesn't show is lost). The details window stays until that
// is ready, then Edit or Delete replace it. Cancel puts the window back; a save or a delete closes it, shows a
// toast and calls `onChanged` so the page reads its week (and month) again. `subjects` are the student's own.
export default function useEntryEdit({ subjects, onChanged }) {
  const [open, setOpen] = useState(null); // { mode, entry, stored, timetable, reopen }
  const loading = useRef(false);

  const start = (mode) => async (entry, { close, reopen }) => {
    if (loading.current) return;
    loading.current = true;
    const result = await fetchTimetable(entry.scheduleId);
    loading.current = false;
    if (result.error) {
      if (!isTimetableGone(result)) return void toast.error(result.error);
      toast.error(TIMETABLE_GONE, { toastId: "entry-timetable-gone" });
      close();
      return onChanged();
    }
    const timetable = result.data.schedule;
    const stored = timetable.entries.find((item) => item._id === entry.entryId);
    if (!stored) {
      toast.error(`That ${labelOf(entry.kind).toLowerCase()} isn't on the timetable anymore.`);
      close();
      return onChanged();
    }
    close();
    setOpen({ mode, entry, stored, timetable, reopen });
  };

  const back = () => {
    setOpen(null);
    open.reopen(open.entry, open.mode);
  };
  const finish = (message, kind = open.stored.kind) => {
    setOpen(null);
    toast.success(`${labelOf(kind)} ${message}.`);
    onChanged();
  };
  const gone = () => {
    setOpen(null);
    toast.error(`That ${labelOf(open.stored.kind).toLowerCase()} isn't on the timetable anymore.`);
    onChanged();
  };

  let dialog = null;
  if (open?.mode === "edit") {
    dialog = (
      <EntryFormDialog
        kind={open.stored.kind}
        entry={open.stored}
        subjects={subjects}
        timetable={open.timetable}
        onClose={back}
        onSaved={(_schedule, kind) => finish("saved", kind)}
        onGone={gone}
      />
    );
  } else if (open?.mode === "delete") {
    dialog = (
      <DeleteEntryDialog
        entry={open.stored}
        timetable={open.timetable}
        subject={subjects.find((subject) => subject._id === open.stored.subject)}
        onClose={back}
        onDeleted={() => finish("deleted")}
        onGone={gone}
      />
    );
  }

  return { onEditEntry: start("edit"), onDeleteEntry: start("delete"), dialog };
}
