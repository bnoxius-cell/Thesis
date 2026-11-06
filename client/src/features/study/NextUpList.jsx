import { Link } from "react-router-dom";
import { Card } from "@/shared/ui";
import { taskDueIso } from "@/utils/scheduleUtils";
import SubjectRow from "./SubjectRow";

const MAX_ROWS = 5;

// The first MAX_ROWS items, except that the nearest exam is always kept: it takes the last row when
// it would fall past the cap. `items` is already sorted by date.
function capRows(items) {
  const rows = items.slice(0, MAX_ROWS);
  const exam = items.find((item) => item.kind === "exam");
  return exam && !rows.includes(exam) ? [...items.slice(0, MAX_ROWS - 1), exam] : rows;
}

// "Next up" (Figma 76:1062): the subject's open tasks and the classes and exams still to come this
// week in one list, soonest first, five rows at most (the nearest exam always shows). Task rows lead
// with the done box, which the frame does not draw (owner decision, 2026-11-01); onToggle is
// useTaskDone's setDone. When the cap hides some tasks, "See all N tasks" opens `allTasksTo`.
export default function NextUpList({ tasks, upcoming, now, onToggle, allTasksTo }) {
  const items = [
    ...tasks.map((task) => ({ kind: "task", key: task._id, iso: taskDueIso(task.dueDate), task })),
    ...upcoming.map(({ iso, entry }) => ({
      kind: entry.kind === "exam" ? "exam" : "class",
      key: `${iso}-${entry._id ?? `${entry.title}-${entry.startTime}`}`,
      iso,
      entry,
    })),
  ].sort((a, b) => a.iso.localeCompare(b.iso));
  const rows = capRows(items);
  const hiddenTasks = tasks.length > rows.filter((item) => item.kind === "task").length;

  return (
    <Card as="section" className="subject-card" aria-labelledby="subject-next-title">
      <h2 id="subject-next-title" className="subject-card__title">Next up</h2>
      {rows.length === 0 ? (
        <p className="subject-card__quiet">Nothing coming up. Enjoy the breathing room.</p>
      ) : (
        <ul className="subject-rows stagger">
          {rows.map((item) => (
            <SubjectRow key={item.key} item={item} now={now} onToggle={onToggle} />
          ))}
        </ul>
      )}
      {hiddenTasks && (
        <Link to={allTasksTo} className="subject-card__link">See all {tasks.length} tasks</Link>
      )}
    </Card>
  );
}
