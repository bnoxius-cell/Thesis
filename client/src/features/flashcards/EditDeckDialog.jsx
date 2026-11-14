import { useEffect, useState } from "react";
import { Button, Modal } from "@/shared/ui";
import { fetchSubjects } from "@/shared/api/subjects";
import DeckFields from "./DeckFields";
import "../study/study-dialog.css";
import "./deck.css";

const MAX_TITLE = 120;

// Edit deck (Figma 261:1919): the same Title and Subject fields as Write my own. The subjects load when the
// dialog opens (the page doesn't need them otherwise); the dialog is usable for the title meanwhile, and a
// failed load leaves the subject as it was. `onSave({ title, subject })` answers { error } or not.
export default function EditDeckDialog({ deck, onSave, onClose }) {
  const [subjects, setSubjects] = useState(null);
  const [title, setTitle] = useState(deck.title);
  const [subject, setSubject] = useState(deck.subject ?? "");
  const [titleError, setTitleError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetchSubjects().then((res) => live && setSubjects(res.data?.subjects ?? []));
    return () => {
      live = false;
    };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!title.trim()) return setTitleError("Give the deck a title.");
    setBusy(true);
    setError("");
    // Without the list there is nothing to pick from, so the subject is left out and stays as it was.
    const { error: failure } = await onSave({ title: title.trim(), ...(subjects ? { subject: subject || null } : {}) });
    setBusy(false);
    if (failure) setError(failure);
    else onClose();
  };

  return (
    <Modal
      as="form"
      onSubmit={submit}
      noValidate
      sheet
      className="deck-dialog"
      title="Edit deck"
      busy={busy}
      onClose={onClose}
      confirmClose={() => title !== deck.title || subject !== (deck.subject ?? "")}
      actions={<Button type="submit" busy={busy}>Save</Button>}
    >
      <DeckFields
        title={title}
        onTitle={(value) => {
          setTitle(value);
          setTitleError("");
        }}
        subject={subject}
        onSubject={setSubject}
        subjects={subjects ?? []}
        titleError={titleError}
        maxTitle={MAX_TITLE}
        disabled={busy}
      />
      {error && <p className="deck-error" role="alert">{error}</p>}
    </Modal>
  );
}
