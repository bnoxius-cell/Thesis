import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchSubject } from "@/shared/api/subjects";
import { fetchTasks } from "@/shared/api/tasks";
import { fetchReviewers } from "@/shared/api/reviewers";
import { fetchMainTimetable } from "@/shared/api/schedules";

// Everything the Subject overview shows, for one subject id.
//   status    "loading" | "ready" | "missing" (no such subject, or not theirs) | "failed"
//   error     a plain message for the failed state
//   subject   the subject with its name, code, term and colour
//   tasks     this subject's open tasks, soonest due first; `setTasks` takes the whole task list's
//             updater, so a tick (useTaskDone) updates the page at once
//   reviewers this subject's reviewers, newest first
//   entries   main timetable entries; empty when there is none or it could not load
//   reload    fetches again behind the skeleton (Try again)
// Only the subject itself decides between ready, missing and failed: a failed task, reviewer or
// timetable fetch leaves that part empty instead of blocking the page.
export default function useSubject(id) {
  const [state, setState] = useState({ status: "loading", error: "", subject: null });
  const [data, setData] = useState({ tasks: [], reviewers: [], entries: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", error: "", subject: null });
    Promise.all([fetchSubject(id), fetchTasks(), fetchReviewers(), fetchMainTimetable()]).then(
      ([subjectRes, taskRes, reviewerRes, timetableRes]) => {
        if (cancelled) return;
        if (subjectRes.error) {
          const missing = subjectRes.fromApi === true && subjectRes.status === 404;
          setState({ status: missing ? "missing" : "failed", error: subjectRes.error, subject: null });
          return;
        }
        setData({
          tasks: taskRes.data?.tasks ?? [],
          reviewers: reviewerRes.data?.reviewers ?? [],
          entries: timetableRes.data?.schedule?.entries ?? [],
        });
        setState({ status: "ready", error: "", subject: subjectRes.data.subject });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const setTasks = useCallback((update) => setData((prev) => ({ ...prev, tasks: update(prev.tasks) })), []);

  const openTasks = useMemo(
    () =>
      data.tasks
        .filter((task) => task.subject === id && !task.isCompleted)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)),
    [data.tasks, id],
  );
  const reviewers = useMemo(() => data.reviewers.filter((r) => r.subject === id), [data.reviewers, id]);

  return { ...state, tasks: openTasks, reviewers, entries: data.entries, setTasks, reload };
}
