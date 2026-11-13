import { useRef } from "react";
import { Link } from "react-router-dom";
import { Circle, CircleCheck, FileText, Flag, RotateCcw, Shapes, Timer } from "lucide-react";
import { Button, Chip } from "@/shared/ui";
import useNow from "@/shared/hooks/useNow";
import ItemDetailDialog, { DetailFooter } from "./ItemDetailDialog";
import { DetailRow, DetailRows } from "./DetailRows";
import { doneOnText, sizeText, taskChip, taskDueText } from "./detailText";
import { subjectHref, taskHref, taskSubject } from "./itemLinks";

// A task in the details window (Figma D1): the due chip and a "Mark as done" row (or "Done on" and Reopen
// once it's done), then the subject, due day, size and notes. `onEdit` and `onDelete` are passed only when
// the student can use them, and a missing one draws no button. `focus` ("edit" or "delete") puts focus on
// that button when the window comes back from its dialog.
export default function TaskDetails({ task, subjects, context, onClose, onBack, returnFocusRef, focus, onToggle, onEdit, onDelete }) {
  const editRef = useRef(null);
  const deleteRef = useRef(null);
  const now = useNow();
  const subject = taskSubject(task, subjects);
  const chip = taskChip(task, now);

  // Close first, so the Undo toast and the row leaving the list run with the page free to scroll again.
  const toggle = () => {
    onClose();
    onToggle(task, !task.isCompleted);
  };
  const handlers = { close: onClose };

  const subjectValue = subject ? (
    <Link className="detail-link" to={subjectHref(subject._id)} onClick={onClose}>
      {subject.name}
    </Link>
  ) : (
    task.course
  );
  const inThisSubject = subject && context === `subject:${subject._id}`;

  const footer = (
    <DetailFooter
      remove={onDelete && (
        <Button ref={deleteRef} variant="ghost" className="item-footer__delete" onClick={() => onDelete(task, handlers)}>
          Delete
        </Button>
      )}
      edit={onEdit && (
        <Button ref={editRef} variant="secondary" className="item-footer__edit" onClick={() => onEdit(task, handlers)}>
          Edit
        </Button>
      )}
      primary={context !== "plan-tasks" && (
        <Button className="item-footer__go" to={taskHref(task._id)} onClick={onClose}>Open in Tasks</Button>
      )}
    />
  );

  return (
    <ItemDetailDialog
      title={task.title}
      subtitle={`Task · ${subject?.name || task.course || "No subject"}`}
      onClose={onClose}
      onBack={onBack}
      returnFocusRef={returnFocusRef}
      initialFocusRef={focus === "delete" ? deleteRef : focus === "edit" ? editRef : undefined}
      footer={footer}
    >
      {chip && <Chip tone={chip.tone} className="item-chip">{chip.label}</Chip>}
      {onToggle && !task.isCompleted && (
        <button type="button" className="item-done" onClick={toggle}>
          <Circle size={24} aria-hidden="true" />
          <span>Mark as done</span>
        </button>
      )}
      {onToggle && task.isCompleted && (
        <div className="item-done item-done--complete">
          <CircleCheck size={24} aria-hidden="true" />
          <span>{`Done${task.completedAt ? ` on ${doneOnText(task)}` : ""}`}</span>
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={toggle}>Reopen</Button>
        </div>
      )}
      <DetailRows>
        {!inThisSubject && (
          <DetailRow icon={Shapes} label="Subject" muted={!subjectValue}>
            {subjectValue || "No subject"}
          </DetailRow>
        )}
        <DetailRow icon={Flag} label="Due">{taskDueText(task)}</DetailRow>
        <DetailRow icon={Timer} label="Size">{sizeText(task.hours)}</DetailRow>
        <DetailRow icon={FileText} label="Notes">
          {task.description && <span className="detail-notes">{task.description}</span>}
        </DetailRow>
      </DetailRows>
    </ItemDetailDialog>
  );
}
