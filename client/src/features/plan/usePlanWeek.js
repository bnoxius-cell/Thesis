import { useCallback, useEffect, useState } from "react";
import { fetchTasks } from "@/shared/api/tasks";
import { fetchSubjects } from "@/shared/api/subjects";
import { fetchWeekOverview } from "@/shared/api/schedules";
import { toISODate } from "@/utils/scheduleUtils";

// What the Plan page reads: the student's tasks and subjects (fetched once) and the week overview for
// the shown Monday (fetched again whenever the week changes). A response for a week the student has
// already left is ignored, so stepping quickly never shows the wrong week.
//   status       "loading" | "ready" | "failed" for the page as a whole
//   error        a plain message for the failed state
//   overview     the shown week's overview, or null while it loads
//   tasks        every task; `setTasks(updater)` lets a tick update the list in place
//   subjectsById Map of subject id to subject (empty if the list could not load)
//   reload       fetches the tasks and the week again
export default function usePlanWeek(weekStart) {
  const startIso = toISODate(weekStart);
  const [base, setBase] = useState({ status: "loading", error: "", tasks: [], subjectsById: new Map() });
  // The week that last answered, with the word "for" so a stale answer is easy to tell from a current one.
  const [week, setWeek] = useState({ for: "", overview: null, error: "" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchTasks(), fetchSubjects()]).then(([taskRes, subjectRes]) => {
      if (cancelled) return;
      if (taskRes.error) {
        setBase((b) => ({ ...b, status: "failed", error: taskRes.error }));
        return;
      }
      setBase({
        status: "ready",
        error: "",
        tasks: taskRes.data.tasks,
        subjectsById: new Map((subjectRes.data?.subjects ?? []).map((s) => [s._id, s])),
      });
    });
    return () => { cancelled = true; };
  }, [attempt]);

  useEffect(() => {
    let cancelled = false;
    fetchWeekOverview(startIso).then(({ data, error }) => {
      if (!cancelled) setWeek({ for: startIso, overview: data ?? null, error: error ?? "" });
    });
    return () => { cancelled = true; };
  }, [startIso, attempt]);

  // Takes an updater function, the way useTaskDone calls it.
  const setTasks = useCallback((update) => setBase((b) => ({ ...b, tasks: update(b.tasks) })), []);

  const reload = useCallback(() => {
    setBase((b) => ({ ...b, status: "loading" }));
    setWeek({ for: "", overview: null, error: "" });
    setAttempt((n) => n + 1);
  }, []);

  const weekReady = week.for === startIso;
  const failed = base.status === "failed" || (weekReady && week.error);
  return {
    status: failed ? "failed" : base.status === "ready" && weekReady ? "ready" : "loading",
    error: base.error || (weekReady ? week.error : ""),
    overview: weekReady ? week.overview : null,
    tasks: base.tasks,
    setTasks,
    subjectsById: base.subjectsById,
    reload,
  };
}
