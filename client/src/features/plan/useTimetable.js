import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTimetable, fetchTimetableStamp, isTimetableGone } from "@/shared/api/schedules";
import usePolling from "@/shared/hooks/usePolling";

// How often an open timetable asks whether anyone changed it. The check is tiny; the whole
// timetable is only downloaded again when the answer differs from the version already shown.
export const LIVE_CHECK_MS = 4000;

// One timetable by id, kept up to date while it is open (`id` null means My week, nothing to load).
//   status    "idle" | "loading" | "ready" | "failed"
//   schedule  the timetable with its entries once ready, otherwise null
//   error     a plain message for the failed state
//   reload    tries again after a failure
// `onGone` runs once when the server says the timetable was deleted or is no longer shared with the
// student (including an id that never existed), so the page can fall back to My week.
// The live check runs every 4 seconds, only while the tab is in front, and stops with the page.
export default function useTimetable(id, onGone) {
  const [loaded, setLoaded] = useState({ id: null, schedule: null, error: "" });
  const [attempt, setAttempt] = useState(0);
  const stamp = useRef("");
  const current = useRef(id);
  const gone = useRef(onGone);
  useEffect(() => {
    current.current = id;
    gone.current = onGone;
  });

  // Downloads the timetable. `quiet` keeps what is on screen if the download fails (a live refresh).
  const load = useCallback(async (quiet) => {
    const asked = current.current;
    const res = await fetchTimetable(asked);
    if (current.current !== asked) return;
    if (isTimetableGone(res)) {
      gone.current();
    } else if (res.error) {
      if (!quiet) setLoaded({ id: asked, schedule: null, error: res.error });
    } else {
      stamp.current = res.data.schedule.updatedAt;
      setLoaded({ id: asked, schedule: res.data.schedule, error: "" });
    }
  }, []);

  useEffect(() => {
    stamp.current = "";
    if (id) load(false);
  }, [id, attempt, load]);

  const check = useCallback(async () => {
    const asked = current.current;
    if (!asked || !stamp.current) return;
    const res = await fetchTimetableStamp(asked);
    if (current.current !== asked) return;
    if (isTimetableGone(res)) gone.current();
    else if (res.data && res.data.updatedAt !== stamp.current) load(true);
  }, [load]);

  usePolling(check, LIVE_CHECK_MS, { enabled: Boolean(id) });

  const reload = useCallback(() => {
    setLoaded({ id: null, schedule: null, error: "" });
    setAttempt((n) => n + 1);
  }, []);

  const answered = loaded.id === id;
  if (!id) return { status: "idle", schedule: null, error: "", reload };
  if (!answered) return { status: "loading", schedule: null, error: "", reload };
  return loaded.error
    ? { status: "failed", schedule: null, error: loaded.error, reload }
    : { status: "ready", schedule: loaded.schedule, error: "", reload };
}
