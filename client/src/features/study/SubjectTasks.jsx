import { CheckCircle2 } from "lucide-react";
import { Button, Card, EmptyState } from "@/shared/ui";
import { taskDueIso } from "@/utils/scheduleUtils";
import SubjectRow from "./SubjectRow";

// The Tasks tab: every open task of this subject, soonest first, then the ones ticked off this week
// (unticking one puts it back). Both lists come from the page's one task state, so a tick here also
// leaves Overview's Next up. `onNew` opens New task on this subject.
export default function SubjectTasks({ tasks, doneTasks, now, onToggle, onNew }) {
  return (
    <div className="subject-stack">
      {tasks.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No open tasks"
          actions={<Button onClick={onNew}>New task</Button>}
        >
          Add one and it goes on your plan.
        </EmptyState>
      ) : (
        <Card as="section" className="subject-card" aria-labelledby="subject-open-title">
          <div className="subject-card__head">
            <h2 id="subject-open-title" className="subject-card__title">Open tasks</h2>
            <Button variant="secondary" onClick={onNew}>New task</Button>
          </div>
          <ul className="subject-rows stagger">
            {tasks.map((task) => (
              <SubjectRow
                key={task._id}
                item={{ kind: "task", iso: taskDueIso(task.dueDate), task }}
                now={now}
                onToggle={onToggle}
              />
            ))}
          </ul>
        </Card>
      )}
      {doneTasks.length > 0 && (
        <Card as="section" className="subject-card" aria-labelledby="subject-done-title">
          <h2 id="subject-done-title" className="subject-card__title">Done recently</h2>
          <ul className="subject-rows">
            {doneTasks.map((task) => (
              <SubjectRow key={task._id} item={{ kind: "done", task }} now={now} onToggle={onToggle} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
