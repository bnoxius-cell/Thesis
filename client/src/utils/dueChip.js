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
