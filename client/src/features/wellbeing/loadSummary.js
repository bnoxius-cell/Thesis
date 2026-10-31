import { taskDueIso } from "@/utils/scheduleUtils";

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const joinWords = (parts) => (parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0]);

// What lands on the heaviest day, in one sentence: "3 tasks and 2 classes land on Thursday." `day` is that
// day from the week, `name` how to call it ("Today" or a weekday), `tasks` the open tasks. A day that is
// heavy only because study work was spread onto it has nothing due, so it falls back to the hours.
export function heaviestDetail(day, name, tasks) {
  const due = tasks.filter((task) => taskDueIso(task.dueDate) === day.key).length;
  const classes = day.entries.filter((entry) => entry.kind === "class").length;
  const exams = day.entries.filter((entry) => entry.kind === "exam").length;
  const parts = [
    due && plural(due, "task", "tasks"),
    classes && plural(classes, "class", "classes"),
    exams && plural(exams, "exam", "exams"),
  ].filter(Boolean);

  const when = name === "Today" ? "today" : `on ${name}`;
  if (parts.length) return `${joinWords(parts)} land ${when}.`;
  const hours = Math.round((day.busyHours + day.load) * 10) / 10;
  return `About ${hours} h of work lands ${when}.`;
}
