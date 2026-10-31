import { addDays, startOfWeek, taskDueIso, toISODate } from "@/utils/scheduleUtils";

const byDue = (a, b) => taskDueIso(a.dueDate).localeCompare(taskDueIso(b.dueDate));
const byFinished = (a, b) => String(b.completedAt ?? "").localeCompare(String(a.completedAt ?? ""));

// Sorts every task into the groups the Tasks view draws, relative to `now`:
//   overdue  open and due before today (oldest first)
//   today    open and due today
//   week     open and due after today and up to this week's Sunday
//   later    open and due after that
//   done     ticked off, most recently finished first
// Each group is sorted by due date; the task objects are passed through untouched.
export function groupTasks(tasks, now = new Date()) {
  const todayIso = toISODate(now);
  const weekEndIso = toISODate(addDays(startOfWeek(now), 6));
  const groups = { overdue: [], today: [], week: [], later: [], done: [] };

  tasks.forEach((task) => {
    if (task.isCompleted) {
      groups.done.push(task);
      return;
    }
    const dueIso = taskDueIso(task.dueDate);
    if (dueIso < todayIso) groups.overdue.push(task);
    else if (dueIso === todayIso) groups.today.push(task);
    else if (dueIso <= weekEndIso) groups.week.push(task);
    else groups.later.push(task);
  });

  ["overdue", "today", "week", "later"].forEach((key) => groups[key].sort(byDue));
  groups.done.sort(byFinished);
  return groups;
}
