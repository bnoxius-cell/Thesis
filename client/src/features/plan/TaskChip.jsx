import TaskCheck from "@/features/tasks/TaskCheck";
import ItemOpenButton from "@/features/details/ItemOpenButton";
import { taskMeta } from "./taskText";

// An open task under its due day, with its done box. Overdue ones turn red. `item` is
// { task, dueIso, overdue } from planDays; `roomy` is the phone agenda, which has the width to spell
// the due date out. The title opens the task's details window through `onOpen(task)`.
export default function TaskChip({ item, now, onToggle, onOpen, roomy = false }) {
  return (
    <li className={`plan-task item-row${item.overdue ? " is-overdue" : ""}${roomy ? " is-roomy" : ""}`}>
      <TaskCheck task={item.task} onChange={onToggle} />
      <div className="plan-task__text">
        <p className="plan-task__title">
          <ItemOpenButton onClick={() => onOpen(item.task)}>{item.task.title}</ItemOpenButton>
        </p>
        <p className="plan-task__meta">{taskMeta(item, now, roomy)}</p>
      </div>
    </li>
  );
}
