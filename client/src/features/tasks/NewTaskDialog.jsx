import { useState } from "react";
import { Button, Field, Modal, Segment, SelectButton } from "@/shared/ui";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import useSaveTask from "./useSaveTask";
import { NO_SUBJECT, TASK_SIZES, TASK_TITLE_MAX, emptyTaskForm, taskErrors, taskStarted } from "./taskForm";
import "./task-dialog.css";

// New task. Not drawn in Figma: built from the shared primitives in the style of the rhythm dialog.
// `subjects` is the list the page already loaded. Nothing is saved until the button; closing with a
// title typed asks first. A failed save keeps the dialog open with the message.
export default function NewTaskDialog({ subjects, onClose, onSaved }) {
  const [form, setForm] = useState(() => emptyTaskForm());
  const [errors, setErrors] = useState({});
  const { save, saving, error } = useSaveTask();
  const phone = useMediaQuery("(max-width: 480px)");
  const subjectOptions = [
    { value: NO_SUBJECT, label: "No subject" },
    ...subjects.map((subject) => ({ value: subject._id, label: subject.name })),
  ];
  const set = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = taskErrors(form);
    if (Object.keys(found).length > 0) return setErrors(found);
    const task = await save(form);
    if (task) onSaved(task);
  };

  return (
    <Modal
      as="form"
      onSubmit={submit}
      noValidate
      className="task-dialog"
      title="New task"
      subtitle="It goes on your plan and counts toward your week."
      busy={saving}
      onClose={onClose}
      confirmClose={() => taskStarted(form)}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" busy={saving}>{saving ? "Saving" : "Add task"}</Button>
        </>
      }
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
            onChange={set("subject")}
            label="Subject"
            {...control}
          />
        )}
      </Field>
      <Field
        label="Due"
        type="date"
        value={form.dueDate}
        onChange={(event) => set("dueDate")(event.target.value)}
        error={errors.dueDate}
        required
      />
      <Field label="Size">
        {({ labelId }) => <Segment labelId={labelId} options={TASK_SIZES} value={form.hours} onChange={set("hours")} />}
      </Field>
      {error && <p className="task-dialog__error" role="alert">{error}</p>}
    </Modal>
  );
}
