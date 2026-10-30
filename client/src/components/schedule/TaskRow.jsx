import SubjectDot from "../subject/SubjectDot";
import TaskCheck from "../TaskCheck";
import { dueChip, taskEditLabel } from "../../utils/dueChip";

// One task in a list: done box, title with its course (and the subject's dot when it has one), due chip.
// Anything passed as children (a More menu) sits at the end of the row.
//
//   subject      the task's subject, if it has one
//   entering     the row just arrived, so it eases in
//   onSetDone    (task, done) => resolves to false if it didn't save
//   onEdit       (task) => void
export default function TaskRow({ task, subject, now, entering = false, onSetDone, onEdit, children }) {
  const chip = task.isCompleted ? null : dueChip(task.dueDate, now);
  const course = [task.course || "No course", task.hours ? `${task.hours}h` : ""].filter(Boolean).join(" · ");
  return (
    <li className={`task-row${task.isCompleted ? " is-done" : ""}${entering ? " is-entering" : ""}`}>
      <TaskCheck task={task} onChange={onSetDone} />
      <button type="button" className="task-row-body" onClick={() => onEdit(task)} aria-label={taskEditLabel(task, now)}>
        <strong>{task.title}</strong>
        <span className={`${task.course ? "" : "is-empty"}${subject ? " subject-line" : ""}`.trim() || undefined}>
          {subject && <SubjectDot color={subject.color} />}
          {course}
        </span>
      </button>
      {chip && <span className={`chip is-${chip.tone}`}>{chip.label}</span>}
      {children}
    </li>
  );
}
