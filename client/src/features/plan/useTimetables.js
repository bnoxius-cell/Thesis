import { useCallback, useEffect, useState } from "react";
import { fetchTimetables } from "@/shared/api/schedules";

// The main timetable first, then the student's own extras, then the ones shared with them. Each
// group keeps the server's order (most recently changed first).
export function sortTimetables(list) {
  const rank = (t) => (t.role !== "owner" ? 2 : t.isMain ? 0 : 1);
  return [...list].sort((a, b) => rank(a) - rank(b));
}

// The timetables the switcher lists.
//   status       "loading" | "ready" | "failed"
//   timetables   sorted summaries ({ _id, title, isMain, role, countInWorkload, ... }); empty until ready
//   reload       tries the list again
export default function useTimetables() {
  const [state, setState] = useState({ status: "loading", timetables: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchTimetables().then(({ data, error }) => {
      if (cancelled) return;
      setState(error ? { status: "failed", timetables: [] } : { status: "ready", timetables: sortTimetables(data.schedules) });
    });
    return () => { cancelled = true; };
  }, [attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading", timetables: [] });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, reload };
}
