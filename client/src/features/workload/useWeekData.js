import { useCallback, useEffect, useState } from "react";
import { fetchTasks } from "@/shared/api/tasks";
import { fetchWeekOverview } from "@/shared/api/schedules";
import { fetchSubjects } from "@/shared/api/subjects";
import { toISODate } from "@/utils/scheduleUtils";

// Loads what every "my week" screen reads: the student's tasks, the next seven days of their timetable
// and their subjects. The profile comes from AuthContext's userData, so it is not fetched again here.
//   status       "loading" | "ready" | "failed"  (failed only when the tasks could not load)
//   error        a plain message for the failed state
//   tasks        every task, done or not; `setTasks` lets a mutation update the list in place
//   overview     the week overview, or null (a failed overview counts as no timetable)
//   subjectsById Map of subject id to subject, empty if the list could not load
//   reload       fetches everything again
export default function useWeekData() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [tasks, setTasks] = useState([]);
  const [overview, setOverview] = useState(null);
  const [subjectsById, setSubjectsById] = useState(() => new Map());

  const load = useCallback(async () => {
    const [taskRes, weekRes, subjectRes] = await Promise.all([
      fetchTasks(),
      fetchWeekOverview(toISODate(new Date())),
      fetchSubjects(),
    ]);
    if (taskRes.error) {
      setError(taskRes.error);
      setStatus("failed");
      return;
    }
    setTasks(taskRes.data.tasks);
    setOverview(weekRes.data ?? null);
    setSubjectsById(new Map((subjectRes.data?.subjects ?? []).map((s) => [s._id, s])));
    setStatus("ready");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reload = useCallback(() => {
    setStatus("loading");
    return load();
  }, [load]);

  return { status, error, tasks, setTasks, overview, subjectsById, reload };
}
