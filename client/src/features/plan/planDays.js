import { addDays, fromISODate, taskDueIso, toISODate } from "@/utils/scheduleUtils";
import { subjectForLabel } from "@/utils/subjectColors";
import { subjectTone } from "@/shared/lib/subjectTone";
import { dayLoad } from "./dayLoad";

const minutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// Classes take their subject's tone when the title matches a subject's name or code (timetable
// entries carry no subject id); every other kind of entry reads as neutral. Exams draw themselves.
export function withLook(entry, subjects) {
  const subject = entry.kind === "class" ? subjectForLabel(entry.title, subjects) : null;
  return {
    ...entry,
    id: `${entry.startTime}-${entry.endTime}-${entry.title}`,
    tone: subject ? subjectTone(subject.color) : "neutral",
    hours: Math.max(minutes(entry.endTime) - minutes(entry.startTime), 0) / 60,
  };
}

// Overdue work moves to today when today is on this page, so it sits where the student is looking.
// On any other week it stays on the day it was due.
function dayForTask(dueIso, todayIso, isos) {
  if (dueIso < todayIso && isos.includes(todayIso)) return todayIso;
  return dueIso;
}

// The open tasks that sit on day `iso`, overdue ones first: those due that day, plus every overdue task
// when `iso` is today (see dayForTask). Done tasks leave (ticking one removes it, and Undo brings it back).
function tasksOnDay(tasks, iso, todayIso) {
  return tasks
    .filter((task) => !task.isCompleted)
    .map((task) => ({ task, dueIso: taskDueIso(task.dueDate), overdue: taskDueIso(task.dueDate) < todayIso }))
    .filter((item) => dayForTask(item.dueIso, todayIso, [iso]) === iso)
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.dueIso.localeCompare(b.dueIso));
}

// One day ready to draw, in the week columns and in the day window. `overviewDay` is that day's entry in
// the server's week overview ({ date, holiday, busyHours, entries }) or undefined; `subjects` is a list.
//   tasks    every task; `task` in each day item is the original, so mutations keep their identity
//   profile  profileFromUser (useWorkload.js), for the load dot
export function buildDay({ iso, overviewDay, tasks, subjects, profile, todayIso }) {
  const date = fromISODate(iso);
  const dayTasks = tasksOnDay(tasks, iso, todayIso);
  return {
    key: iso,
    date,
    weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
    dayNumber: date.getDate(),
    label: date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
    isToday: iso === todayIso,
    holiday: overviewDay?.holiday ?? null,
    entries: (overviewDay?.entries ?? []).map((entry) => withLook(entry, subjects)),
    tasks: dayTasks,
    load: dayLoad({ busyHours: overviewDay?.busyHours ?? 0, tasks: dayTasks.map((item) => item.task), profile }),
  };
}

// The overview entry for day `iso` in a list of week overviews (nulls allowed), or undefined when none covers it.
export function findOverviewDay(overviews, iso) {
  return overviews.flatMap((overview) => overview?.days ?? []).find((day) => day.date === iso);
}

// The seven days of one Monday-to-Sunday week, ready to draw. `overview` is the server's week
// overview ({ days: [{ date, holiday, busyHours, entries }] }) or null; a single timetable can pass
// the same shape. Open tasks sit under their due day (buildDay).
//   weekStart, overview, tasks, profile as in buildDay
//   subjectsById  Map of subject id to subject, for entry tones
export function buildPlanDays({ weekStart, overview, tasks, subjectsById, profile, now }) {
  const todayIso = toISODate(now);
  const byDate = new Map((overview?.days ?? []).map((day) => [day.date, day]));
  const subjects = [...subjectsById.values()];
  return Array.from({ length: 7 }, (_, i) => toISODate(addDays(weekStart, i))).map((iso) =>
    buildDay({ iso, overviewDay: byDate.get(iso), tasks, subjects, profile, todayIso }),
  );
}
