import { taskDueIso } from "@/utils/scheduleUtils";
import { effortLabel } from "@/shared/lib/effort";

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const joinWords = (parts) => (parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0]);

// Why the heaviest day is heavy, in one sentence under "<Day> looks heaviest.": "3 big deadlines land on
// it." or "2 deadlines and 3 classes land on it." Deadlines are only called big when every one of them is
// a Large task. `day` is that day from the week, `tasks` the open tasks. A day that is heavy only because
// prep for later deadlines was spread onto it has nothing due, so it falls back to the hours.
export function heaviestDetail(day, tasks) {
  const due = tasks.filter((task) => taskDueIso(task.dueDate) === day.key);
  const big = due.length > 0 && due.every((task) => effortLabel(task.hours) === "Large");
  const classes = day.entries.filter((entry) => entry.kind === "class").length;
  const exams = day.entries.filter((entry) => entry.kind === "exam").length;
  const counts = [
    [due.length, big ? "big deadline" : "deadline", big ? "big deadlines" : "deadlines"],
    [classes, "class", "classes"],
    [exams, "exam", "exams"],
  ].filter(([n]) => n > 0);

  if (counts.length) {
    const one = counts.length === 1 && counts[0][0] === 1;
    return `${joinWords(counts.map(([n, single, many]) => plural(n, single, many)))} ${one ? "lands" : "land"} on it.`;
  }
  const hours = Math.round((day.busyHours + day.load) * 10) / 10;
  return `About ${hours} h of work lands on it.`;
}
