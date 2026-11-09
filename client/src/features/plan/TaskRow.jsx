import { Chip } from "@/shared/ui";
import TaskCheck from "@/features/tasks/TaskCheck";
import ItemOpenButton from "@/features/details/ItemOpenButton";
import { dueChip } from "@/shared/lib/dueChip";
import { effortLabel } from "@/shared/lib/effort";
import { subjectTone } from "@/shared/lib/subjectTone";
import { taskDueIso } from "@/utils/scheduleUtils";
import { dueDay } from "./taskText";

// The due chip's tones: today and tomorrow read as accent here, overdue as the red chip.
const CHIP_TONE = { danger: "danger", watch: "accent", neutral: "neutral" };

// One task in the Tasks view (Figma 39:549): done box, title, its subject, when it is due and how big
// it is. Overdue rows get a red outline and chip; done rows are struck through and carry no chips.
// Focus is not built. The title opens the task's details window through `onOpen(task)`, done tasks too (that
// is where Reopen lives). `found` marks the row a link landed on (`?task=`), so it flashes.
export default function TaskRow({ task, subject, now, onToggle, onOpen, found = false }) {
  const due = dueChip(task.dueDate, now);
  const overdue = !task.isCompleted && due.days < 0;
  const label = overdue ? `Overdue, ${dueDay(taskDueIso(task.dueDate), now)}` : due.label;

  return (
    <li
      className={`plan-row item-row${overdue ? " is-overdue" : ""}${task.isCompleted ? " is-done" : ""}${found ? " is-found" : ""}`}
      data-task-id={task._id}
    >
      <TaskCheck task={task} onChange={onToggle} />
      <div className="plan-row__text">
        <p className="plan-row__title">
          <ItemOpenButton onClick={() => onOpen(task)}>{task.title}</ItemOpenButton>
        </p>
        {task.course && (
          <p className="plan-row__subject">
            <span className={`plan-row__dot plan-row__dot--${subjectTone(subject?.color)}`} aria-hidden="true" />
            {task.course}
          </p>
        )}
      </div>
      {!task.isCompleted && (
        <div className="plan-row__chips">
          <Chip tone={CHIP_TONE[due.tone]}>{label}</Chip>
          <Chip tone="neutral">{effortLabel(task.hours)}</Chip>
        </div>
      )}
    </li>
  );
}
