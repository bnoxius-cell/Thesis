import { fromISODate, toISODate } from "@/utils/scheduleUtils";
import { dueWords } from "@/shared/lib/dueChip";
import { effortLabel } from "@/shared/lib/effort";

// The weekday a task was due on, or the date once that is more than a week ago.
function dueDay(dueIso, now) {
  const daysAgo = Math.round((fromISODate(toISODate(now)) - fromISODate(dueIso)) / 86400000);
  return fromISODate(dueIso).toLocaleDateString("en-US", daysAgo < 7 ? { weekday: "short" } : { month: "short", day: "numeric" });
}

// The small line under a task's title. A week column is narrow, so it says "Overdue, Tue" or the
// task's subject and size; the day's agenda has room to say "Overdue, was due Tue" or "Due today".
export function taskMeta({ task, dueIso, overdue }, now, roomy) {
  if (overdue) return roomy ? `Overdue, was due ${dueDay(dueIso, now)}` : `Overdue, ${dueDay(dueIso, now)}`;
  if (roomy) return dueWords(task.dueDate, now);
  return [task.course, effortLabel(task.hours)].filter(Boolean).join(" · ");
}
