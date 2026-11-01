// Tasks finished in the last 7 days, from the `completedAt` the server stamps when a task is
// ticked off. Older tasks (finished before that existed) have no stamp and don't count.
export function finishedThisWeek(tasks = [], now = new Date()) {
  const since = new Date(now).getTime() - 7 * 86400000;
  return tasks.filter((t) => t.isCompleted && t.completedAt && new Date(t.completedAt).getTime() >= since);
}
