import { addDays, monthWeeks, taskDueIso, toISODate } from "@/utils/scheduleUtils";
import { subjectForLabel } from "@/utils/subjectColors";
import { subjectTone } from "@/shared/lib/subjectTone";
import { withLook } from "./planDays";

const MAX_DOTS = 4;

// What one day of the month grid carries. Classes become dots (their subject's tone); a holiday, an
// exam and each open task become short labels. Labels run holiday, exam, overdue tasks, other tasks.
function buildDay({ date, monthIndex, todayIso, overviewDay, tasks, subjects }) {
  const iso = toISODate(date);
  const entries = (overviewDay?.entries ?? []).map((entry) => withLook(entry, subjects));
  const labels = [];
  if (overviewDay?.holiday) labels.push({ id: "holiday", text: overviewDay.holiday, tone: "neutral" });
  entries.filter((entry) => entry.kind === "exam").forEach((entry) => {
    labels.push({ id: `exam-${entry.id}`, text: `Exam: ${entry.title}`, tone: "watch" });
  });
  tasks
    .map((task) => ({ task, overdue: iso < todayIso }))
    .forEach(({ task, overdue }) => {
      const subject = subjectForLabel(task.course, subjects);
      labels.push({ id: task._id, text: task.title, tone: overdue ? "danger" : subjectTone(subject?.color) });
    });

  const classes = entries.filter((entry) => entry.kind === "class");
  return {
    key: iso,
    date,
    dayNumber: date.getDate(),
    isToday: iso === todayIso,
    inMonth: date.getMonth() === monthIndex,
    dots: classes.slice(0, MAX_DOTS).map((entry) => entry.tone),
    classCount: classes.length,
    labels,
  };
}

// The month as rows of seven days, Monday first, for the grid (Figma 38:234). A week belongs to the
// month its Thursday is in, so the first and last rows can hold days of the next or last month
// (`inMonth` false). `overviews` is a Map of week-start ISO date to that week's server overview;
// open tasks sit on the day they are due, overdue ones stay on that day.
export function buildMonthRows({ month, overviews, tasks, subjectsById, now }) {
  const todayIso = toISODate(now);
  const subjects = [...subjectsById.values()];
  const byDay = new Map(
    [...overviews.values()].flatMap((overview) => overview.days.map((day) => [day.date, day])),
  );
  const tasksByDay = new Map();
  tasks.filter((task) => !task.isCompleted).forEach((task) => {
    const iso = taskDueIso(task.dueDate);
    tasksByDay.set(iso, [...(tasksByDay.get(iso) ?? []), task]);
  });

  return monthWeeks(month).map((weekStart) =>
    Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const iso = toISODate(date);
      return buildDay({
        date, monthIndex: month.getMonth(), todayIso, overviewDay: byDay.get(iso), tasks: tasksByDay.get(iso) ?? [], subjects,
      });
    }),
  );
}

// The ISO date of each week row's Monday, for fetching the month's overviews.
export const monthWeekIsos = (month) => monthWeeks(month).map(toISODate);
