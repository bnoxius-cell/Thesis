import { toISODate, taskDueIso } from "../../utils/scheduleUtils";

// Monday to Sunday of the week `now` falls in, as ISO dates.
function weekBounds(now) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start: toISODate(start), end: toISODate(end) };
}

// "4 of 9 tasks due this week are done." with a thin bar. Counts every task (finished ones too)
// whose due date falls in the current Monday to Sunday. Hidden when nothing is due.
export default function WeekProgress({ tasks, now }) {
  const { start, end } = weekBounds(now);
  const due = tasks.filter((task) => {
    const iso = taskDueIso(task.dueDate);
    return iso >= start && iso <= end;
  });
  if (due.length === 0) return null;

  const done = due.filter((task) => task.isCompleted).length;
  const allDone = done === due.length;

  return (
    <div className="week-progress">
      <p>{done} of {due.length} {due.length === 1 ? "task" : "tasks"} due this week {due.length === 1 ? "is" : "are"} done.</p>
      {done > 0 && (
        <div className={`progress${allDone ? " is-good" : ""}`} aria-hidden="true">
          <span style={{ transform: `scaleX(${done / due.length})` }} />
        </div>
      )}
    </div>
  );
}
