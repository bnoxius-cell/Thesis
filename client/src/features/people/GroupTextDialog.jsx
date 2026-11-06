import { useState } from "react";
import { Button, Field, Modal } from "@/shared/ui";

// A one-field dialog over the Info dialog: the group's name or its pinned note. `onSave(text)`
// answers true when it worked (the caller closes it); on a failure it stays open with what was typed.
// With `allowEmpty` an empty box is a valid save (it clears the note). Save is off until something changed.
export default function GroupTextDialog({ title, label, hint, initial, maxLength, multiline, allowEmpty, busy, onSave, onClose }) {
  const [text, setText] = useState(initial);
  const value = text.trim();
  const canSave = value !== initial.trim() && (allowEmpty || value !== "");

  const submit = async (event) => {
    event.preventDefault();
    if (canSave && (await onSave(value))) onClose();
  };

  return (
    <Modal
      as="form"
      title={title}
      busy={busy}
      onClose={onClose}
      onSubmit={submit}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" busy={busy} disabled={!canSave}>
            Save
          </Button>
        </>
      }
    >
      <Field
        label={label}
        hint={hint}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={maxLength}
        multiline={multiline}
        rows={multiline ? 4 : undefined}
        autoFocus
        autoComplete="off"
      />
    </Modal>
  );
}
