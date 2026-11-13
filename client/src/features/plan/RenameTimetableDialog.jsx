import { useState } from "react";
import { Button, Field, Modal } from "@/shared/ui";
import { updateTimetable } from "@/shared/api/schedules";
import "./timetable-menu.css";

export const TIMETABLE_TITLE_MAX = 80;

// Owner only (Figma D10, Edit timetable). A failed save keeps the dialog open with the server's message.
export default function RenameTimetableDialog({ timetable, onClose, onRenamed }) {
  const [title, setTitle] = useState(timetable.title);
  const [titleError, setTitleError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const trimmed = title.trim();
  const changed = trimmed !== timetable.title;

  const submit = async (event) => {
    event.preventDefault();
    if (!trimmed) return setTitleError("Give the timetable a name.");
    if (!changed) return onClose();
    setSaving(true);
    setError("");
    const { error: failure } = await updateTimetable(timetable._id, { title: trimmed });
    setSaving(false);
    if (failure) setError(failure);
    else onRenamed(trimmed);
  };

  return (
    <Modal
      as="form"
      onSubmit={submit}
      noValidate
      title="Edit timetable"
      subtitle="Everyone on it sees the new name."
      busy={saving}
      onClose={onClose}
      confirmClose={() => changed}
      actions={(close) => (
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>Cancel</Button>
          <Button type="submit" busy={saving}>{saving ? "Saving" : "Save changes"}</Button>
        </>
      )}
    >
      <Field
        label="Name"
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
          setTitleError("");
        }}
        error={titleError}
        maxLength={TIMETABLE_TITLE_MAX}
        autoComplete="off"
        required
      />
      {error && <p className="timetable-menu__error" role="alert">{error}</p>}
    </Modal>
  );
}
