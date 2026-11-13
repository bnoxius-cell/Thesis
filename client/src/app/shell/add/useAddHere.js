import { useEffect, useRef } from "react";
import { useGlobalAdd } from "./addContext";

// A page's say in the global add while it is on screen:
//   subject    the subject this page is about (the Subject page): Task and Reviewer start on it, and only list it
//   subjects   the subjects the page already loaded; without them the add loads its own
//   timetable  the picked timetable the student can edit (Plan): classes, exams, events and activities go there
//   onAdded    (kind, result) after a save, so the page can refresh. `result` is the task, the subject,
//              { schedule, entry } for an entry, and nothing for a reviewer
// The latest onAdded is always the one called, so the page doesn't need to memoise it.
export default function useAddHere({ subject, subjects, timetable, onAdded }) {
  const { register } = useGlobalAdd();
  const latest = useRef(onAdded);
  useEffect(() => {
    latest.current = onAdded;
  });

  useEffect(
    () => register({ subject, subjects, timetable, onAdded: (kind, result) => latest.current?.(kind, result) }),
    [register, subject, subjects, timetable],
  );
}
