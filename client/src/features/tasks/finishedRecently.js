const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// How many tasks were ticked off in the last 7 days.
export function finishedRecently(tasks, now = new Date()) {
  const since = now.getTime() - WEEK_MS;
  return tasks.filter((task) => task.isCompleted && task.completedAt && new Date(task.completedAt).getTime() >= since).length;
}
