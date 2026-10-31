import "./tasks-view.css";
import { CheckCheck } from "lucide-react";
import { EmptyState } from "@/shared/ui";
import { groupTasks } from "@/features/tasks/groupTasks";
import { subjectForLabel } from "@/utils/subjectColors";
import TaskGroup from "./TaskGroup";
import TaskRow from "./TaskRow";

const DONE_SHOWN = 5;
const TODAY_NOTE = { weekday: "short", month: "short", day: "numeric" };

// The Tasks view (Figma 38:276): every task in groups. Overdue and Today share one tinted panel; the
// rest follow in the main column, with Later and Done in a side column from 1024px. Ticking a task
// moves it to Done (useTaskDone shows the Undo). Only the five most recently finished tasks are
// listed under Done; the count is all of them.
export default function TasksView({ tasks, subjectsById, now, onToggle }) {
  const groups = groupTasks(tasks, now);
  const subjects = [...subjectsById.values()];
  const rows = (list) => list.map((task) => (
    <TaskRow key={task._id} task={task} subject={subjectForLabel(task.course, subjects)} now={now} onToggle={onToggle} />
  ));
  const open = groups.overdue.length + groups.today.length + groups.week.length + groups.later.length;

  if (tasks.length === 0) {
    return (
      <EmptyState page icon={CheckCheck} title="No tasks yet">
        Tasks you add show up here, grouped by when they are due.
      </EmptyState>
    );
  }

  return (
    <div className="plan-tasks">
      <div className="plan-tasks__main stagger">
        {open === 0 && (
          <EmptyState icon={CheckCheck} title="All clear">Nothing is waiting on you right now.</EmptyState>
        )}
        {(groups.overdue.length > 0 || groups.today.length > 0) && (
          <div className="plan-tasks__panel">
            <TaskGroup title="Overdue" count={groups.overdue.length} tone="danger">{rows(groups.overdue)}</TaskGroup>
            <TaskGroup title="Today" count={groups.today.length} tone="accent" note={now.toLocaleDateString("en-US", TODAY_NOTE)}>
              {rows(groups.today)}
            </TaskGroup>
          </div>
        )}
        <TaskGroup title="This week" count={groups.week.length}>{rows(groups.week)}</TaskGroup>
      </div>
      <div className="plan-tasks__side stagger">
        <TaskGroup title="Later" count={groups.later.length}>{rows(groups.later)}</TaskGroup>
        <TaskGroup title="Done" count={groups.done.length} tone="good">{rows(groups.done.slice(0, DONE_SHOWN))}</TaskGroup>
      </div>
    </div>
  );
}
