import { useEffect, useRef } from "react";
import { useGlobalAdd } from "./addContext";

// A page's say in the global add while it is on screen:
//   subject    the subject this page is about (the Subject page): Task and Reviewer start on it, and only list it
//   subjects   the subjects the page already loaded; without them the add loads its own
//   timetable  the picked timetable the student can edit (Plan): classes, exams, events and activities go there
//   onAdded    (kind, result) after a save, so the page can refresh. `result` is the task, the subject,
//              { schedule, entry } for an entry, and nothing for a reviewer
//   openUpload opens the page's own Upload dialog, for pages that hold an upload queue (Files, a Subject): the
//              File row uses it instead of the host's dialog. It does nothing while the page can't upload yet.
// The latest onAdded and openUpload are always the ones called, so the page doesn't need to memoise them.
export default function useAddHere({ subject, subjects, timetable, onAdded, openUpload }) {
  const { register } = useGlobalAdd();
  const latest = useRef({ onAdded, openUpload });
  useEffect(() => {
    latest.current = { onAdded, openUpload };
  });
  const hasUpload = Boolean(openUpload);

  useEffect(
    () =>
      register({
        subject,
        subjects,
        timetable,
        onAdded: (kind, result) => latest.current.onAdded?.(kind, result),
        openUpload: hasUpload ? () => latest.current.openUpload() : undefined,
      }),
    [register, subject, subjects, timetable, hasUpload],
  );
}
