import { fromISODate, toISODate, taskDueIso } from "./scheduleUtils";

const WEEKDAY = { weekday: "short" };
const SHORT_DATE = { month: "short", day: "numeric" };

// "Overdue", "Today", "Tomorrow", "Fri" within the week, "Oct 24" beyond it. Tone says how urgent.
export function dueChip(dueDate, now = new Date()) {
  const due = fromISODate(taskDueIso(dueDate));
  const today = fromISODate(toISODate(now));
  const days = Math.round((due - today) / 86400000);
  if (days < 0) return { label: "Overdue", tone: "danger", days };
  if (days === 0) return { label: "Today", tone: "watch", days };
  if (days === 1) return { label: "Tomorrow", tone: "watch", days };
  if (days < 7) return { label: due.toLocaleDateString("en-US", WEEKDAY), tone: "neutral", days };
  return { label: due.toLocaleDateString("en-US", SHORT_DATE), tone: "neutral", days };
}

// "overdue", "due today", "due tomorrow", "due in 3 days", or "due Oct 24" for anything past a week.
export function dueWords(dueDate, now = new Date()) {
  const { days } = dueChip(dueDate, now);
  if (days < 0) return "overdue";
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  if (days < 7) return `due in ${days} days`;
  return `due ${fromISODate(taskDueIso(dueDate)).toLocaleDateString("en-US", SHORT_DATE)}`;
}

// The spoken name of a row's edit button: "Edit Print slides, Web Systems, due in 2 days".
export const taskEditLabel = (task, now = new Date()) =>
  `Edit ${task.title}, ${task.course ? `${task.course}, ` : ""}${dueWords(task.dueDate, now)}`;
