import { dueChip, dueWords } from "@/shared/lib/dueChip";
import { fromISODate, taskDueIso } from "@/utils/scheduleUtils";

// Turns the server's shared-task deadlines into rows for the Upcoming tab: what is overdue is
// left out, and the rest splits into "This week" (the next 7 days) and "Later". The chip says how
// near the due date is: Today and Tomorrow are watch, anything further is neutral.
export function buildUpcoming(deadlines, myId, now = new Date()) {
  const week = [];
  const later = [];
  deadlines.forEach((d) => {
    const { days, tone } = dueChip(d.task.dueDate, now);
    if (days < 0) return;
    const due = fromISODate(taskDueIso(d.task.dueDate));
    const sharer = d.sharedBy?._id === myId ? "you" : d.sharedBy?.name || "a former member";
    const row = {
      id: d._id,
      weekday: due.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      day: due.getDate(),
      title: d.task.title,
      sub: `Task${d.task.course ? `, ${d.task.course}` : ""}, shared by ${sharer}`,
      chip: { label: dueWords(d.task.dueDate, now), tone },
      added: d.addedByMe,
      source: d,
    };
    (days < 7 ? week : later).push(row);
  });
  return { week, later };
}
