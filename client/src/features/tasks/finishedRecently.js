const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// The tasks ticked off in the last 7 days.
export function recentlyFinished(tasks, now = new Date()) {
  const since = now.getTime() - WEEK_MS;
  return tasks.filter((task) => task.isCompleted && task.completedAt && new Date(task.completedAt).getTime() >= since);
}

// How many tasks were ticked off in the last 7 days.
export const finishedRecently = (tasks, now = new Date()) => recentlyFinished(tasks, now).length;
