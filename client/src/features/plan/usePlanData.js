import { useMemo } from "react";
import useHolidays from "./useHolidays";
import usePlanWeek from "./usePlanWeek";
import useTimetable from "./useTimetable";
import { timetableWeek, weekYears } from "./timetableWeek";

const NO_TASKS = [];

// Everything the Week view draws, from either source. My week (no `timetableId`) is the week
// overview plus the student's tasks. One timetable is that timetable's own entries and holidays,
// with no tasks (they belong to the student's week, not to a timetable).
// Returns usePlanWeek's shape (`status`, `error`, `overview`, `tasks`, `setTasks`, `subjectsById`,
// `reload`) plus `holidayError`, a plain message when public holidays couldn't load for a timetable.
// `onTimetableGone` runs once when the open timetable was deleted or is no longer shared.
export default function usePlanData(weekStart, timetableId, onTimetableGone, withOverview = true) {
  const myWeek = !timetableId;
  const week = usePlanWeek(weekStart, { myWeek, withOverview });
  const timetable = useTimetable(timetableId, onTimetableGone);
  const holidays = useHolidays(weekYears(weekStart), !myWeek);

  const overview = useMemo(
    () => (myWeek ? week.overview : timetableWeek(timetable.schedule, weekStart, holidays.byDate)),
    [myWeek, week.overview, timetable.schedule, weekStart, holidays.byDate],
  );

  if (myWeek) return { ...week, holidayError: "" };

  const failed = week.status === "failed" || timetable.status === "failed";
  const ready = week.status === "ready" && timetable.status === "ready" && !holidays.pending;
  return {
    ...week,
    status: failed ? "failed" : ready ? "ready" : "loading",
    error: timetable.error || week.error,
    overview,
    tasks: NO_TASKS,
    holidayError: holidays.error,
    reload: () => {
      week.reload();
      timetable.reload();
    },
  };
}
