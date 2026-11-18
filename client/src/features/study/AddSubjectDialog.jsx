import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button, Field, Modal } from "@/shared/ui";
import useEntryTarget from "@/features/plan/useEntryTarget";
import ClassTimeRow from "./term/ClassTimeRow";
import { MAX_CLASS_TIMES } from "./term/newTermForm";
import {
  addSubjectErrors,
  addSubjectStarted,
  addTime,
  changeTime,
  clashNotesFor,
  emptyAddSubjectForm,
  hasErrors,
  removeTime,
} from "./addSubjectForm";
import { SUBJECT_LIMITS } from "./subjectForm";
import useSaveSubject from "./useSaveSubject";
import "./study-dialog.css";

// Add subject (Figma MS-1: desktop 400:605, 400:432, 400:731, phone sheets 403:266, 403:355, 403:509): the one
// form for a subject and its class times. Name, code and any number of class times (up to six, the rows of the
// new-term wizard); saving makes the subject and puts its class times on the main timetable in one go. The
// class times are optional. A clash with something already on the timetable only warns. Nothing is saved
// until the button; closing with changes asks first. A failed save keeps the dialog open with the message.
// `onSaved` gets the new subject, with `classTimesAdded`.
export default function AddSubjectDialog({ onClose, onSaved }) {
  const [start] = useState(emptyAddSubjectForm);
  const [form, setForm] = useState(start);
  const [showErrors, setShowErrors] = useState(false);
  const { save, saving, error } = useSaveSubject(null);
  const target = useEntryTarget(null);
  const started = addSubjectStarted(start, form);
  const errors = useMemo(() => (showErrors ? addSubjectErrors(form) : { name: "", times: {} }), [showErrors, form]);
  const notes = useMemo(() => clashNotesFor(form, target?.entries), [form, target]);
  const full = form.classTimes.length >= MAX_CLASS_TIMES;

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (hasErrors(addSubjectErrors(form))) return setShowErrors(true);
    const saved = await save(form);
    if (saved) onSaved(saved);
  };

  let subtitle = "Its class times go on your main timetable.";
  if (target) subtitle = `Its class times go on ${target.title}, your main timetable.`;
  else if (target === null) subtitle = "Its class times go on a new timetable called My timetable.";

  return (
    <Modal
      as="form"
      onSubmit={submit}
      noValidate
      sheet
      className="study-dialog add-subject"
      title="Add subject"
      subtitle={subtitle}
      busy={saving}
      onClose={onClose}
      confirmClose={() => started}
      actions={(close) => (
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>Cancel</Button>
          <Button type="submit" busy={saving}>{saving ? "Saving" : "Add subject"}</Button>
        </>
      )}
    >
      <div className="add-subject__top">
        <Field
          label="Name"
          value={form.name}
          onChange={set("name")}
          error={errors.name}
          placeholder="e.g. Data Structures"
          maxLength={SUBJECT_LIMITS.name}
          autoComplete="off"
          required
        />
        <Field
          label="Code (optional)"
          className="add-subject__code"
          value={form.code}
          onChange={set("code")}
          placeholder="e.g. IT 201"
          maxLength={SUBJECT_LIMITS.code}
          autoComplete="off"
        />
      </div>
      <section className="add-subject__times" aria-labelledby="add-subject-times">
        <div className="add-subject__times-head">
          <h3 id="add-subject-times">Class times</h3>
          <p>Optional. A different time on another day? Add another class time.</p>
        </div>
        {form.classTimes.map((time, index) => (
          <ClassTimeRow
            key={time.key}
            time={time}
            position={index + 1}
            error={errors.times[time.key]}
            note={notes[time.key]}
            onChange={(fields) => setForm((prev) => changeTime(prev, time.key, fields))}
            onRemove={() => setForm((prev) => removeTime(prev, time.key))}
          />
        ))}
        <Button variant="ghost" icon={Plus} className="add-subject__add" disabled={full} onClick={() => setForm(addTime)}>
          {full ? `${MAX_CLASS_TIMES} class times is the most for one subject` : "Add a class time"}
        </Button>
      </section>
      {error && <p className="study-dialog__error" role="alert">{error}</p>}
    </Modal>
  );
}
