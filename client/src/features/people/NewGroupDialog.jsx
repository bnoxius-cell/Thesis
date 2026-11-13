import { useState } from "react";
import { Button, Field, Modal } from "@/shared/ui";
import { createGroup } from "@/shared/api/groups";
import "./people-new.css";

const NAME_MAX = 60;
const DESCRIPTION_MAX = 140;

// "New group" (opened by the global Add and the empty Groups page, through the add host). A name, an optional description
// and the family-friendly switch, which the server enforces in chat and admins can change later in
// Info. The server's own words show under the name and the dialog stays open with what was typed.
// `onDone(group)` runs once the group exists (the host toasts with a View button and the page refreshes its list).
export default function NewGroupDialog({ onClose, onDone }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [familyFriendly, setFamilyFriendly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the group a name.");
      return;
    }
    setBusy(true);
    const { data, error: failure } = await createGroup({ name: trimmed, description: description.trim(), familyFriendly });
    if (!data) {
      setBusy(false);
      setError(failure);
      return;
    }
    onDone(data.group);
  };

  return (
    <Modal
      as="form"
      title="New group"
      subtitle="A chat for your class, with shared deadlines."
      busy={busy}
      onClose={onClose}
      onSubmit={submit}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" busy={busy}>
            Create group
          </Button>
        </>
      }
    >
      <Field
        label="Group name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError("");
        }}
        error={error}
        maxLength={NAME_MAX}
        placeholder="e.g. BSIT 2A study squad"
        autoFocus
        autoComplete="off"
      />
      <Field
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={DESCRIPTION_MAX}
        placeholder="What is this group for?"
        autoComplete="off"
      />
      <label className="people-switch">
        <span className="people-switch__text">
          <span className="people-switch__title">Family-friendly chat</span>
          <span className="people-switch__hint">Blocks messages with swearing or explicit words.</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="people-switch__input"
          checked={familyFriendly}
          onChange={(e) => setFamilyFriendly(e.target.checked)}
        />
      </label>
    </Modal>
  );
}
