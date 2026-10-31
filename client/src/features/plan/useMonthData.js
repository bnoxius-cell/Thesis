import { useEffect, useState } from "react";
import { fetchWeekOverview } from "@/shared/api/schedules";
import { monthWeekIsos } from "./monthDays";

const NONE = new Map();
const FAILED = "We couldn't load this month. Check your connection and try again.";

// The week overviews behind one month of the grid, fetched together and kept for the session, so
// stepping back to a month that was already shown is instant. `monthStart` is the first of the month;
// `enabled` is false while another view is open. Returns
//   status     "loading" | "ready" | "failed"
//   error      a plain message for the failed state
//   overviews  Map of week-start ISO date to overview (empty until ready)
//   reload     forgets this month and fetches it again
export default function useMonthData(monthStart, enabled) {
  const key = monthWeekIsos(monthStart).join();
  const [cache, setCache] = useState(() => new Map());
  const [failedKey, setFailedKey] = useState("");
  const [attempt, setAttempt] = useState(0);
  const cached = cache.get(key);

  useEffect(() => {
    if (!enabled || cached) return undefined;
    let cancelled = false;
    const isos = key.split(",");
    Promise.all(isos.map(fetchWeekOverview)).then((results) => {
      if (cancelled) return;
      if (results.some((res) => res.error || !res.data)) {
        setFailedKey(key);
        return;
      }
      setCache((prev) => new Map(prev).set(key, new Map(isos.map((iso, i) => [iso, results[i].data]))));
    });
    return () => { cancelled = true; };
  }, [enabled, key, cached, attempt]);

  const reload = () => {
    setFailedKey("");
    setAttempt((n) => n + 1);
    setCache((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  };

  const failed = !cached && failedKey === key;
  return {
    status: cached ? "ready" : failed ? "failed" : "loading",
    error: failed ? FAILED : "",
    overviews: cached ?? NONE,
    reload,
  };
}
