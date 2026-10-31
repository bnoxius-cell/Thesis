import { useCallback, useEffect, useState } from "react";
import { fetchSubjects } from "@/shared/api/subjects";
import { fetchMainTimetable } from "@/shared/api/schedules";

// The student's subjects, plus the entries of their main timetable (for each card's next class).
//   status   "loading" | "ready" | "failed"  (failed only when the subjects could not load)
//   error    a plain message for the failed state
//   subjects the subject list with its counts
//   entries  main timetable entries; empty when there is no timetable or it could not load
//   reload   fetches again behind the skeleton (Try again)
//   refresh  fetches again in place (after a create, edit or delete)
export default function useSubjects() {
  const [state, setState] = useState({ status: "loading", error: "", subjects: [], entries: [] });

  const load = useCallback(async (quiet = false) => {
    const [subjectRes, timetableRes] = await Promise.all([fetchSubjects(), fetchMainTimetable()]);
    if (subjectRes.error) {
      if (quiet) return;
      setState({ status: "failed", error: subjectRes.error, subjects: [], entries: [] });
      return;
    }
    setState({
      status: "ready",
      error: "",
      subjects: subjectRes.data.subjects,
      entries: timetableRes.data?.schedule?.entries ?? [],
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, status: "loading" }));
    return load();
  }, [load]);

  // After a change: fetch again in place. The cards stay mounted, and a failed fetch keeps them.
  const refresh = useCallback(() => load(true), [load]);

  return { ...state, reload, refresh };
}
