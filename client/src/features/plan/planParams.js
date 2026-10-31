import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { addDays, fromISODate, startOfWeek, toISODate } from "@/utils/scheduleUtils";

export const PLAN_VIEWS = ["week", "month", "tasks"];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// The Monday of the week an ?week= value points at, or null when it isn't a real date.
function weekFromParam(value) {
  if (!ISO_DAY.test(value ?? "")) return null;
  const date = fromISODate(value);
  return toISODate(date) === value ? startOfWeek(date) : null;
}

// What the address says the Plan page should show: `view` (default week), `week` (the Monday shown,
// default this week) and `timetable` (a timetable id, default null for "My week"). Anything unknown
// falls back to the default, so a hand-edited link never breaks the page.
export function readPlanParams(searchParams, today = new Date()) {
  const view = searchParams.get("view");
  return {
    view: PLAN_VIEWS.includes(view) ? view : "week",
    weekStart: weekFromParam(searchParams.get("week")) ?? startOfWeek(today),
    timetable: searchParams.get("timetable") || null,
  };
}

// Sets or clears one query value without touching the others.
function withParam(searchParams, key, value) {
  const next = new URLSearchParams(searchParams);
  if (value) next.set(key, value);
  else next.delete(key);
  return next;
}

// The Plan page's view, week and timetable, read from and written to the URL (one source of truth,
// so a reload or a shared link lands on the same screen). Week steps replace the history entry so
// Back leaves the page instead of walking through weeks.
export function usePlanParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => readPlanParams(searchParams), [searchParams]);

  const setView = useCallback((view) => {
    setSearchParams((prev) => withParam(prev, "view", view === "week" ? null : view));
  }, [setSearchParams]);

  // `weekStart` is a Monday; the current week is the default, so it leaves no ?week= behind.
  const setWeekStart = useCallback((weekStart) => {
    const isCurrent = toISODate(weekStart) === toISODate(startOfWeek(new Date()));
    setSearchParams((prev) => withParam(prev, "week", isCurrent ? null : toISODate(weekStart)), { replace: true });
  }, [setSearchParams]);

  const shiftWeek = useCallback((weeks) => {
    setWeekStart(addDays(params.weekStart, weeks * 7));
  }, [params.weekStart, setWeekStart]);

  const goToday = useCallback(() => setWeekStart(startOfWeek(new Date())), [setWeekStart]);

  const setTimetable = useCallback((id) => {
    setSearchParams((prev) => withParam(prev, "timetable", id), { replace: true });
  }, [setSearchParams]);

  return { ...params, setView, shiftWeek, goToday, setTimetable };
}
