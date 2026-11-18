import { dueChip, dueWords } from "@/shared/lib/dueChip";
import { clockTime, dayLabel } from "../chatTime";

// "Ana", "Ana and Mika", "Ana, Mika and Sam", "Ana, Mika and 2 others".
export function listNames(names) {
  if (names.length <= 3) return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} others`;
}

export const hereLine = (names) => `${listNames(names)} ${names.length === 1 ? "is" : "are"} here now`;
export const editingLine = (names) => `${listNames(names)} ${names.length === 1 ? "is" : "are"} editing`;

// The chip an open task shows when it is due within a week: overdue is red, anything nearer is watch.
export function dueNote(task, now) {
  const { days } = dueChip(task.dueDate, now);
  if (days < 0) return { label: "Overdue", tone: "danger" };
  return days < 7 ? { label: dueWords(task.dueDate, now), tone: "watch" } : null;
}

// "Done by Ana, today 9:12 am", "Done by you, yesterday 4:30 pm", "Done by Ana, Oct 24 9:12 am".
export function doneNote(task, myId, now = new Date()) {
  const who = task.completedBy?._id === myId ? "you" : task.completedBy?.name || "someone";
  if (!task.completedAt) return `Done by ${who}`;
  const day = dayLabel(task.completedAt, now);
  const when = day === "Today" || day === "Yesterday" ? day.toLowerCase() : new Date(task.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `Done by ${who}, ${when} ${clockTime(task.completedAt)}`;
}
