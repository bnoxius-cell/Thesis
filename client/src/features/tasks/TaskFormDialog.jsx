import { useState } from "react";
import { Button, Field, Modal, SelectButton } from "@/shared/ui";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import SizeChoice from "./SizeChoice";
import useSaveTask from "./useSaveTask";
import { taskSubject } from "@/features/details/itemLinks";
import NewSubjectNameField from "@/features/study/NewSubjectNameField";
import newSubjectOption from "@/features/study/newSubjectOption";
import { NEW_SUBJECT } from "@/features/study/subjectForm";
import {
  NO_SUBJECT,
  TASK_NOTES_MAX,
  TASK_TITLE_MAX,
  emptyTaskForm,
  sizeOf,
  taskChanges,
  taskErrors,
  taskFormFrom,
  taskStarted,
} from "./taskForm";
import "./task-dialog.css";

const NEW_SUBJECT_OPTION = newSubjectOption("New subject...");

// New task and Edit task (Figma 207:1959, 207:2383, phone sheets 207:2111, 207:2535). Pass `task` to edit
// it: the form starts as that task and Save sends only what changed (nothing at all when nothing did).
// `subjects` is the list the page already loaded. Nothing is saved until the button; closing asks first
// when something was typed (new) or changed (edit). `defaultSubject` is a subject id to start on (the
// Subject page). The Subject dropdown ends with "New subject..." unless `allowNewSubject` is off (a Subject
// page, where the list is that one subject): it opens a required name and the server makes the subject with the
// task. `onSubjectCreated` runs after such a save, before `onSaved`, so the page can read its subjects again.
// A failed save keeps the dialog open with the message. `onSaved` gets the saved task.
export default function TaskFormDialog({ subjects, task, defaultSubject = NO_SUBJECT, allowNewSubject = true, onClose, onSaved, onSubjectCreated }) {
  const editing = Boolean(task);
  const [start] = useState(() => (task ? taskFormFrom(task, taskSubject(task, subjects)?._id) : null));
  const [form, setForm] = useState(() => start ?? { ...emptyTaskForm(), subject: defaultSubject });
  const [errors, setErrors] = useState({});
  const { save, saving, error } = useSaveTask();
  const phone = useMediaQuery("(max-width: 480px)");
  const subjectOptions = [
    { value: NO_SUBJECT, label: "No subject" },
    ...subjects.map((subject) => ({ value: subject._id, label: subject.name })),
    ...(allowNewSubject ? [NEW_SUBJECT_OPTION] : []),
  ];
  const creatingSubject = form.subject === NEW_SUBJECT;
  const set = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };
  const pickSubject = (id) => {
    set("subject")(id);
    setErrors((prev) => ({ ...prev, newSubjectName: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = taskErrors(form);
    if (Object.keys(found).length > 0) return setErrors(found);
    const saved = await save(form, editing ? { task, start } : undefined);
    if (!saved) return;
    if (creatingSubject) onSubjectCreated?.();
    onSaved(saved);
  };

  return (
    <Modal
      as="form"
      onSubmit={submit}
      noValidate
      sheet
      className="task-dialog"
      title={editing ? "Edit task" : "New task"}
      subtitle={editing ? "Changes show everywhere this task appears." : "It goes on your plan and counts toward your week."}
      busy={saving}
      onClose={onClose}
      confirmClose={() => (editing ? Object.keys(taskChanges(start, form)).length > 0 : taskStarted(form))}
      leavePrompt={editing ? { body: "Your changes to this task won't be saved." } : undefined}
      actions={(close) => (
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>Cancel</Button>
          <Button type="submit" busy={saving}>{saving ? "Saving" : editing ? "Save changes" : "Add task"}</Button>
        </>
      )}
    >
      <Field
        label="Task"
        value={form.title}
        onChange={(event) => set("title")(event.target.value)}
        error={errors.title}
        placeholder="e.g. Problem set 4"
        maxLength={TASK_TITLE_MAX}
        autoComplete="off"
        required
      />
      <Field label="Subject (optional)">
        {(control) => (
          <SelectButton
            block
            native={phone}
            options={subjectOptions}
            value={form.subject}
            onChange={pickSubject}
            label="Subject"
            {...control}
          />
        )}
      </Field>
      {creatingSubject && (
        <NewSubjectNameField
          value={form.newSubjectName}
          onChange={(event) => set("newSubjectName")(event.target.value)}
          error={errors.newSubjectName}
          disabled={saving}
        />
      )}
      <Field
        label="Due"
        type="date"
        value={form.dueDate}
        onChange={(event) => set("dueDate")(event.target.value)}
        error={errors.dueDate}
        required
      />
      <SizeChoice value={sizeOf(form.hours)} onChange={set("hours")} disabled={saving} />
      <Field
        label="Notes (optional)"
        className="task-dialog__notes"
        multiline
        value={form.description}
        onChange={(event) => set("description")(event.target.value)}
        placeholder="Anything you want to remember, like pages or links"
        maxLength={TASK_NOTES_MAX}
        hint={`${form.description.length} / ${TASK_NOTES_MAX}`}
      />
      {error && <p className="task-dialog__error" role="alert">{error}</p>}
    </Modal>
  );
}
