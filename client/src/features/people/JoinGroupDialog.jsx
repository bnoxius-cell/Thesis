import { useState } from "react";
import { toast } from "react-toastify";
import { Button, Field, Modal } from "@/shared/ui";
import { joinGroup } from "@/shared/api/groups";
import "./people-new.css";

const CODE_LENGTH = 6;

// "Join a group": the 6-character code a classmate shares from the group's Info. The server's own
// words ("Group not found", "Already a member of this group") show under the field and the dialog
// stays open. `onDone(group)` runs once the student is in (the page refreshes the list and opens it).
export default function JoinGroupDialog({ onClose, onDone }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (code.length !== CODE_LENGTH) {
      setError(`A join code has ${CODE_LENGTH} characters.`);
      return;
    }
    setBusy(true);
    const { data, error: failure } = await joinGroup(code);
    if (!data) {
      setBusy(false);
      setError(failure);
      return;
    }
    toast.success("You joined the group.");
    onDone(data.group);
  };

  return (
    <Modal
      as="form"
      title="Join a group"
      subtitle="Ask a classmate for the code in their group's Info."
      busy={busy}
      onClose={onClose}
      onSubmit={submit}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" busy={busy} disabled={code === ""}>
            Join group
          </Button>
        </>
      }
    >
      <Field
        label="Join code"
        value={code}
        onChange={(e) => {
          setCode(e.target.value.replace(/\s/g, "").toUpperCase());
          setError("");
        }}
        error={error}
        maxLength={CODE_LENGTH * 2}
        className="people-join-code"
        placeholder="ABC123"
        autoFocus
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
      />
    </Modal>
  );
}
