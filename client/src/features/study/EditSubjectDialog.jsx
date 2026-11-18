import { useState } from "react";
import { Button, Field, Modal } from "@/shared/ui";
import useSaveSubject from "./useSaveSubject";
import { SUBJECT_LIMITS, subjectChanged, subjectForm, subjectNameError } from "./subjectForm";
import "./study-dialog.css";

// Edit subject: its name, code and term. New subjects come from AddSubjectDialog. Not drawn in Figma: built from
// the shared primitives in the style of the rhythm dialog. Nothing is saved until the button; closing with
// changes asks first (Modal's leave prompt). A failed save keeps the dialog open with the message.
export default function EditSubjectDialog({ subject, onClose, onSaved }) {
  const [start] = useState(() => subjectForm(subject));
  const [form, setForm] = useState(start);
  const [nameError, setNameError] = useState("");
  const { save, saving, error } = useSaveSubject(subject);
  const changed = subjectChanged(start, form);
  const set = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    if (key === "name") setNameError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    const missing = subjectNameError(form);
    if (missing) return setNameError(missing);
    if (!changed) return onClose();
    const saved = await save(form);
    if (saved) onSaved(saved);
  };

  return (
    <Modal
      as="form"
      onSubmit={submit}
      noValidate
      className="study-dialog"
      title="Edit subject"
      subtitle="Its tasks and reviewers pick up the new name."
      busy={saving}
      onClose={onClose}
      confirmClose={() => changed}
      actions={(close) => (
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>Cancel</Button>
          <Button type="submit" busy={saving}>{saving ? "Saving" : "Save"}</Button>
        </>
      )}
    >
      <Field
        label="Name"
        value={form.name}
        onChange={set("name")}
        error={nameError}
        placeholder="e.g. Data Structures"
        maxLength={SUBJECT_LIMITS.name}
        autoComplete="off"
        required
      />
      <div className="study-dialog__pair">
        <Field
          label="Code (optional)"
          value={form.code}
          onChange={set("code")}
          placeholder="e.g. IT 201"
          maxLength={SUBJECT_LIMITS.code}
          autoComplete="off"
        />
        <Field
          label="Term (optional)"
          value={form.term}
          onChange={set("term")}
          placeholder="e.g. 1st semester"
          maxLength={SUBJECT_LIMITS.term}
          autoComplete="off"
        />
      </div>
      {error && <p className="study-dialog__error" role="alert">{error}</p>}
    </Modal>
  );
}
