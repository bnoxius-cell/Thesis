import { Circle, CircleCheck, Pencil } from "lucide-react";
import { Chip, IconButton } from "@/shared/ui";
import TaskCheck from "@/features/tasks/TaskCheck";
import { doneNote, dueNote, editingLine } from "./groupTaskText";
import { taskMeta } from "./groupTaskForm";

// One group task (Figma GW-1 rows): the done box, title, course and size and due date (or who finished
// it), a chip ("Ana is editing", else how soon it is due), and the edit pencil. A member who can't change
// the plan gets a plain status mark in place of the box and no pencil. `editors` are the people (`{ name }`) who have
// this task's dialog open right now.
export default function GroupTaskRow({ task, canEdit, editors, myId, now, onToggle, onEdit }) {
  const note = task.isCompleted ? null : dueNote(task, now);
  const chip = editors.length > 0 ? { label: editingLine(editors.map((person) => person.name)), tone: "accent" } : note;
  const Status = task.isCompleted ? CircleCheck : Circle;

  return (
    <li className={`group-task${task.isCompleted ? " is-done" : ""}`} data-task-id={task._id}>
      {canEdit ? (
        <TaskCheck task={task} onChange={onToggle} />
      ) : (
        <Status size={20} className="group-task__status" aria-hidden="true" />
      )}
      <div className="group-task__body">
        <div className="group-task__text">
          <p className="group-task__title">{task.title}</p>
          <p className="group-task__meta">{task.isCompleted ? doneNote(task, myId, now) : taskMeta(task)}</p>
        </div>
        {chip && (
          <Chip tone={chip.tone} className="group-task__chip">
            {chip.label}
          </Chip>
        )}
      </div>
      {canEdit && <IconButton plain icon={Pencil} label={`Edit ${task.title}`} onClick={() => onEdit(task)} />}
    </li>
  );
}
