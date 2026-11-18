import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchSubject, fetchSubjectSchedule } from "@/shared/api/subjects";
import { fetchTasks } from "@/shared/api/tasks";
import { fetchMainTimetable } from "@/shared/api/schedules";
import { recentlyFinished } from "@/features/tasks/finishedRecently";
import { toISODate } from "@/utils/scheduleUtils";

// Everything the Subject page shows about one subject id, except its reviewers (useReviewers).
//   status    "loading" | "ready" | "missing" (no such subject, or not theirs) | "failed"
//   error     a plain message for the failed state
//   subject   the subject with its name, code, term and colour
//   tasks     this subject's open tasks, soonest due first
//   doneTasks this subject's tasks ticked off in the last 7 days, newest first
//   entries   main timetable entries; empty when there is none or it could not load
//   classTimes the subject's weekly class times, from every timetable that counts in the week (see the schedule
//             endpoint); empty when none or it could not load
//   setTasks  the task list setter (useTaskDone); one list feeds Overview and the Tasks tab
//   reload    fetches again behind the skeleton (Try again)
//   refresh   fetches again in place (after an edit); a failed fetch keeps what is on screen
// Only the subject itself decides between ready, missing and failed: a failed task, timetable or class times
// fetch leaves that part empty instead of blocking the page.
export default function useSubject(id) {
  const [state, setState] = useState({ status: "loading", error: "", subject: null });
  const [data, setData] = useState({ tasks: [], entries: [], classTimes: [] });
  const [attempt, setAttempt] = useState(0);
  const quiet = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const inPlace = quiet.current;
    quiet.current = false;
    if (!inPlace) setState({ status: "loading", error: "", subject: null });
    const today = toISODate(new Date());
    Promise.all([fetchSubject(id), fetchTasks(), fetchMainTimetable(), fetchSubjectSchedule(id, today)]).then(
      ([subjectRes, taskRes, timetableRes, scheduleRes]) => {
        if (cancelled) return;
        if (subjectRes.error) {
          if (inPlace) return;
          const missing = subjectRes.fromApi === true && subjectRes.status === 404;
          setState({ status: missing ? "missing" : "failed", error: subjectRes.error, subject: null });
          return;
        }
        setData({
          tasks: taskRes.data?.tasks ?? [],
          entries: timetableRes.data?.schedule?.entries ?? [],
          classTimes: scheduleRes.data?.classTimes ?? [],
        });
        setState({ status: "ready", error: "", subject: subjectRes.data.subject });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const refresh = useCallback(() => {
    quiet.current = true;
    setAttempt((n) => n + 1);
  }, []);

  const setTasks = useCallback((update) => setData((d) => ({ ...d, tasks: update(d.tasks) })), []);

  const mine = useMemo(() => data.tasks.filter((task) => task.subject === id), [data.tasks, id]);
  const openTasks = useMemo(
    () => mine.filter((task) => !task.isCompleted).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)),
    [mine],
  );
  const doneTasks = useMemo(
    () => recentlyFinished(mine).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)),
    [mine],
  );

  return { ...state, tasks: openTasks, doneTasks, entries: data.entries, classTimes: data.classTimes, setTasks, reload, refresh };
}
