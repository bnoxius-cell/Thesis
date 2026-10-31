import { toISODate, taskDueIso } from "@/utils/scheduleUtils";

// Tasks whose due date falls in the current Monday to Sunday (finished ones too), and how many of
// them are done: { done, total }. Total is 0 when nothing is due this week.
export function weekProgress(tasks, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const [from, to] = [toISODate(start), toISODate(end)];

  const due = tasks.filter((task) => {
    const iso = taskDueIso(task.dueDate);
    return iso >= from && iso <= to;
  });
  return { done: due.filter((task) => task.isCompleted).length, total: due.length };
}
