import { fromISODate, toISODate, taskDueIso } from "@/utils/scheduleUtils";

const WEEKDAY = { weekday: "short" };
const SHORT_DATE = { month: "short", day: "numeric" };

// How far off a due date is, in whole days (negative once it has passed).
const daysUntil = (dueDate, now) =>
  Math.round((fromISODate(taskDueIso(dueDate)) - fromISODate(toISODate(now))) / 86400000);

// "Overdue", "Today", "Tomorrow", a weekday inside the week, "Oct 24" beyond it. `tone` says how urgent.
export function dueChip(dueDate, now = new Date()) {
  const days = daysUntil(dueDate, now);
  const due = fromISODate(taskDueIso(dueDate));
  if (days < 0) return { label: "Overdue", tone: "danger", days };
  if (days === 0) return { label: "Today", tone: "watch", days };
  if (days === 1) return { label: "Tomorrow", tone: "watch", days };
  if (days < 7) return { label: due.toLocaleDateString("en-US", WEEKDAY), tone: "neutral", days };
  return { label: due.toLocaleDateString("en-US", SHORT_DATE), tone: "neutral", days };
}

// "Overdue", "Due today", "Due tomorrow", "Due in 3 days", or "Due Oct 24" past a week.
export function dueWords(dueDate, now = new Date()) {
  const days = daysUntil(dueDate, now);
  if (days < 0) return "Overdue";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days < 7) return `Due in ${days} days`;
  return `Due ${fromISODate(taskDueIso(dueDate)).toLocaleDateString("en-US", SHORT_DATE)}`;
}
