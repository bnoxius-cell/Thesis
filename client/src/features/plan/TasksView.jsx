import "./tasks-view.css";
import { useEffect, useRef } from "react";
import { CheckCheck } from "lucide-react";
import { toast } from "react-toastify";
import { EmptyState } from "@/shared/ui";
import { prefersLessMotion } from "@/utils/motion";
import { groupTasks } from "@/features/tasks/groupTasks";
import { subjectForLabel } from "@/utils/subjectColors";
import TaskGroup from "./TaskGroup";
import TaskRow from "./TaskRow";
import useFlash from "./useFlash";

const DONE_SHOWN = 5;
const TODAY_NOTE = { weekday: "short", month: "short", day: "numeric" };

// The Tasks view (Figma 38:276): every task in groups. Overdue and Today share one tinted panel; the
// rest follow in the main column, with Later and Done in a side column from 1024px. Ticking a task
// moves it to Done (useTaskDone shows the Undo). Only the five most recently finished tasks are
// listed under Done; the count is all of them. A row's title opens the task's details window (`onOpen`).
// `foundTaskId` is the task a link landed on (`?task=`): its row is scrolled into view, marked for a
// moment and given focus (a done one beyond the five is listed too), then `onFound` drops the id from the
// address. An id that isn't on the list says so once.
export default function TasksView({ tasks, subjectsById, now, onToggle, onOpen, foundTaskId, onFound }) {
  const root = useRef(null);
  const handled = useRef(null);
  const [flashed, flash] = useFlash();

  useEffect(() => {
    if (!foundTaskId) {
      handled.current = null;
      return;
    }
    if (handled.current === foundTaskId) return;
    handled.current = foundTaskId;
    const row = [...(root.current?.querySelectorAll("[data-task-id]") ?? [])].find((el) => el.dataset.taskId === foundTaskId);
    if (row) {
      row.scrollIntoView({ block: "center", behavior: prefersLessMotion() ? "auto" : "smooth" });
      row.querySelector(".item-open")?.focus({ preventScroll: true });
      flash(foundTaskId);
    } else {
      toast("That task isn't on your list anymore.", { toastId: "plan-task-gone" });
    }
    onFound();
  }, [foundTaskId, flash, onFound]);

  const groups = groupTasks(tasks, now);
  const subjects = [...subjectsById.values()];
  // A done task a link points at stays listed even past the five most recent.
  const shownDone = groups.done.filter((task, i) => i < DONE_SHOWN || task._id === foundTaskId || task._id === flashed);
  const rows = (list) => list.map((task) => (
    <TaskRow
      key={task._id}
      task={task}
      subject={subjectForLabel(task.course, subjects)}
      now={now}
      onToggle={onToggle}
      onOpen={onOpen}
      found={task._id === flashed}
    />
  ));
  const dueSoon = groups.overdue.length + groups.today.length + groups.week.length;
  const open = dueSoon + groups.later.length;

  if (tasks.length === 0) {
    return (
      <EmptyState page icon={CheckCheck} title="No tasks yet">
        Tasks you add show up here, grouped by when they are due.
      </EmptyState>
    );
  }

  return (
    <div ref={root} className={`plan-tasks${dueSoon === 0 ? " plan-tasks--single" : ""}`}>
      <div className="plan-tasks__main stagger">
        {open === 0 && (
          <EmptyState icon={CheckCheck} title="All clear">Nothing is waiting on you right now.</EmptyState>
        )}
        {open > 0 && dueSoon === 0 && (
          <p className="plan-tasks__clear">Nothing due this week. Your next tasks are below.</p>
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
        <TaskGroup title="Done" count={groups.done.length} tone="good">{rows(shownDone)}</TaskGroup>
      </div>
    </div>
  );
}
