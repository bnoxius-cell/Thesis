import { useState } from "react";
import { TriangleAlert, Trash2 } from "lucide-react";
import { Button, ConfirmDialog, Field, Modal, SelectButton } from "@/shared/ui";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import { TASK_NOTES_MAX, TASK_TITLE_MAX } from "@/features/tasks/taskForm";
import PeopleAvatar from "../PeopleAvatar";
import GroupTaskDeleted from "./GroupTaskDeleted";
import {
  COURSE_MAX,
  PICKERS,
  changedFields,
  conflictText,
  emptyGroupTaskForm,
  groupTaskEdit,
  groupTaskErrors,
  groupTaskFormFrom,
  rebaseForm,
  taskMeta,
  taskStarted,
} from "./groupTaskForm";
import useSaveGroupTask from "./useSaveGroupTask";
import "./group-task-dialog.css";

const openToo = (others) =>
  `${others.map((person) => person.name).join(" and ")} ${others.length === 1 ? "has" : "have"} this task open too.`;

// New group task and Edit group task (Figma GW-3: desktop 374:662 and 374:923, phone sheets 374:1433 and 374:1592).
// Pass `task` to edit it. Save sends only the fields that changed, each with the value it had when the form
// opened, so an admin who changed another field meanwhile keeps their change. When someone changed the same
// field first, the dialog stays open with their value in that field, the student's other edits intact, and
// a note to check it and save again. When the task was deleted meanwhile it says so and offers to add it again.
//   others     the other people who have this task open right now, as { name, avatar }
//   onSaved    runs with the saved task (the plan closes the dialog and puts it in its list)
//   onDeleted  runs with the id of a task the student deleted from here
//   onGone     runs with the id of a task the dialog found deleted by someone else
// Nothing is saved until the button; closing asks first when something was typed or changed.
export default function GroupTaskDialog({ groupId, groupName, task, others = [], onClose, onSaved, onDeleted, onGone }) {
  const editing = Boolean(task);
  const [base, setBase] = useState(task); // the task as the server last said it
  const [sheet, setSheet] = useState(() => {
    const start = editing ? groupTaskFormFrom(task) : null;
    return { start, form: start ?? emptyGroupTaskForm() };
  });
  const [errors, setErrors] = useState({});
  const [conflict, setConflict] = useState(null); // { summary, notes: { field: line } }
  const [gone, setGone] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { add, change, remove, busy, error } = useSaveGroupTask(groupId);
  const phone = useMediaQuery("(max-width: 480px)");
  const { form, start } = sheet;

  const set = (key) => (value) => {
    setSheet((prev) => ({ ...prev, form: { ...prev.form, [key]: value } }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setConflict((prev) => (prev?.notes[key] ? { ...prev, notes: { ...prev.notes, [key]: undefined } } : prev));
  };
  const text = (key) => (event) => set(key)(event.target.value);
  // A field someone else changed first shows their note and a watch-coloured outline until it is edited.
  const conflicted = (key) => (conflict?.notes[key] ? "is-conflict" : "");

  const submit = async (event) => {
    event.preventDefault();
    const found = groupTaskErrors(form);
    if (Object.keys(found).length > 0) return setErrors(found);

    if (!editing) {
      const result = await add(form);
      if (result.status === "saved") onSaved(result.task);
      return;
    }
    const edit = groupTaskEdit(base, start, form);
    if (!edit) return onSaved(base);

    const result = await change(base._id, edit);
    if (result.status === "saved") onSaved(result.task);
    else if (result.status === "gone") setGone(true);
    else if (result.status === "conflict") {
      setConflict(conflictText(result.conflicts, start, result.task.updatedBy?.name ?? "Someone"));
      setSheet(rebaseForm(sheet, result.task, result.conflicts));
      setBase(result.task);
      setErrors({});
    }
  };

  const confirmDelete = async () => {
    const result = await remove(base._id);
    if (result.status === "saved") onDeleted(base._id);
  };

  const addAgain = async () => {
    const result = await add(form);
    if (result.status !== "saved") return;
    onGone(base._id);
    onSaved(result.task);
  };

  const backToPlan = () => {
    onGone(base._id);
    onClose();
  };

  if (gone) {
    return (
      <GroupTaskDeleted
        summary={{ title: form.title, meta: taskMeta({ course: form.course, hours: form.hours ?? base.hours, dueDate: form.dueDate }) }}
        busy={busy}
        error={error}
        onAddAgain={addAgain}
        onBack={backToPlan}
      />
    );
  }

  return (
    <>
      <Modal
        as="form"
        onSubmit={submit}
        noValidate
        sheet
        className={`group-task-dialog${editing ? " group-task-dialog--editing" : ""}`}
        title={editing ? "Edit group task" : "New group task"}
        subtitle={editing ? `Changes show for everyone in ${groupName}.` : `Everyone in ${groupName} will see this. Admins can change it.`}
        busy={busy}
        onClose={onClose}
        confirmClose={() => (editing ? changedFields(start, form).length > 0 : taskStarted(form))}
        leavePrompt={editing ? { body: "Your changes to this task won't be saved." } : undefined}
        actions={(close) => (
          <>
            {editing && (
              <Button variant="danger" icon={Trash2} className="group-task-dialog__delete" onClick={() => setConfirmingDelete(true)} disabled={busy}>
                Delete task
              </Button>
            )}
            <Button variant="secondary" className="group-task-dialog__cancel" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" className="group-task-dialog__save" busy={busy}>
              {busy ? "Saving" : editing ? "Save" : "Add task"}
            </Button>
          </>
        )}
      >
        {conflict && (
          <p className="group-task-dialog__note" role="alert">
            <TriangleAlert size={20} aria-hidden="true" />
            <span>{conflict.summary}</span>
          </p>
        )}
        {others.length > 0 && (
          <p className="group-task-dialog__others">
            <span className="group-task-dialog__faces" aria-hidden="true">
              {others.map((person) => (
                <PeopleAvatar key={person._id} name={person.name} src={person.avatar} className="group-task-dialog__face" />
              ))}
            </span>
            {openToo(others)}
          </p>
        )}
        <Field
          label="Title"
          value={form.title}
          onChange={text("title")}
          error={errors.title}
          hint={conflict?.notes.title}
          className={conflicted("title")}
          placeholder="What needs doing?"
          maxLength={TASK_TITLE_MAX}
          autoComplete="off"
          required
        />
        <div className="group-task-form__pair">
          <Field
            label="Course (optional)"
            value={form.course}
            onChange={text("course")}
            hint={conflict?.notes.course}
            className={conflicted("course")}
            placeholder="For example, Web Systems"
            maxLength={COURSE_MAX}
            autoComplete="off"
          />
          <Field
            label="Due date"
            type="date"
            value={form.dueDate}
            onChange={text("dueDate")}
            error={errors.dueDate}
            hint={conflict?.notes.dueDate}
            className={conflicted("dueDate")}
            required
          />
        </div>
        <div className="group-task-form__trio">
          {PICKERS.map(({ key, label, optionsFor }) => (
            <Field key={key} label={label} hint={conflict?.notes[key]} className={conflicted(key)}>
              {(control) => (
                <SelectButton
                  block
                  native={phone}
                  options={optionsFor(form[key])}
                  value={form[key]}
                  onChange={set(key)}
                  placeholder="Pick one"
                  label={label}
                  {...control}
                />
              )}
            </Field>
          ))}
        </div>
        <Field
          label="Notes (optional)"
          multiline
          value={form.description}
          onChange={text("description")}
          hint={conflict?.notes.description ?? `${form.description.length} / ${TASK_NOTES_MAX}`}
          className={`group-task-dialog__notes ${conflicted("description")}`}
          placeholder="Anything the group should know"
          maxLength={TASK_NOTES_MAX}
        />
        {error && !confirmingDelete && <p className="group-task-dialog__error" role="alert">{error}</p>}
      </Modal>
      {confirmingDelete && (
        <ConfirmDialog
          open
          sheet
          tone="danger"
          title={`Delete "${base.title}"?`}
          confirmLabel="Delete task"
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmingDelete(false)}
        >
          It leaves the plan for everyone in {groupName}. This can&apos;t be undone.
          {error && <span className="group-task-dialog__error"> {error}</span>}
        </ConfirmDialog>
      )}
    </>
  );
}
