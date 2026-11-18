import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button, Card } from "@/shared/ui";
import { taskDueIso } from "@/utils/scheduleUtils";
import SubjectRow from "./SubjectRow";

const MAX_ROWS = 3;

// "Due soon" (Figma OV-F1): the subject's next three open tasks, soonest first (`tasks` is already in that order),
// each with its done box (onToggle is useTaskDone's setDone) and a title that opens the task's details (`onOpen`).
// "See all N tasks" opens `allTasksTo` when more are hidden. With none it says so and offers "Add task" (`onAdd`),
// so the card never disappears.
export default function DueSoon({ subject, tasks, now, onToggle, onOpen, onAdd, allTasksTo }) {
  return (
    <Card as="section" className="subject-card due-soon" aria-labelledby="due-soon-title">
      <div className="subject-card__head">
        <h2 id="due-soon-title" className="subject-card__title">Due soon</h2>
        {tasks.length > MAX_ROWS && <Link to={allTasksTo} className="subject-card__link">See all {tasks.length} tasks</Link>}
      </div>
      {tasks.length === 0 ? (
        <>
          <p className="subject-card__quiet">No tasks due for {subject.name}.</p>
          <Button variant="ghost" icon={Plus} className="subject-card__add" onClick={onAdd}>Add task</Button>
        </>
      ) : (
        <ul className="subject-rows due-soon__list stagger">
          {tasks.slice(0, MAX_ROWS).map((task) => (
            <SubjectRow key={task._id} item={{ kind: "task", iso: taskDueIso(task.dueDate), task }} now={now} onToggle={onToggle} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </Card>
  );
}
