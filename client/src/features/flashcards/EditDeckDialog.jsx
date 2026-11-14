import { useEffect, useState } from "react";
import { Button, Modal } from "@/shared/ui";
import { fetchSubjects } from "@/shared/api/subjects";
import { NEW_SUBJECT, subjectNameError, subjectPayload } from "@/features/study/subjectForm";
import DeckFields from "./DeckFields";
import "../study/study-dialog.css";
import "./deck.css";

const MAX_TITLE = 120;

// Edit deck (Figma 261:1919): the same Title and Subject fields as Write my own. The subjects load when the
// dialog opens (the page doesn't need them otherwise); the dialog is usable for the title meanwhile, and a
// failed load leaves the subject as it was. The subject can also be a new one: `newSubject` (the name) is sent
// instead of `subject`. `onSave({ title, subject })` answers { error } or not.
export default function EditDeckDialog({ deck, onSave, onClose }) {
  const [subjects, setSubjects] = useState(null);
  const [title, setTitle] = useState(deck.title);
  const [subject, setSubject] = useState(deck.subject ?? "");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [titleError, setTitleError] = useState("");
  const [newSubjectError, setNewSubjectError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetchSubjects().then((res) => live && setSubjects(res.data?.subjects ?? []));
    return () => {
      live = false;
    };
  }, []);

  // Without the list there is nothing to pick from, so the subject is left out and stays as it was.
  const subjectChoice = () => {
    if (!subjects) return {};
    if (subject === NEW_SUBJECT) return { newSubject: subjectPayload({ name: newSubjectName }).name };
    return { subject: subject || null };
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!title.trim()) return setTitleError("Give the deck a title.");
    const nameError = subject === NEW_SUBJECT ? subjectNameError({ name: newSubjectName }) : "";
    if (nameError) return setNewSubjectError(nameError);
    setBusy(true);
    setError("");
    const { error: failure } = await onSave({ title: title.trim(), ...subjectChoice() });
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
        onSubject={(value) => {
          setSubject(value);
          setNewSubjectError("");
        }}
        newSubjectName={newSubjectName}
        onNewSubjectName={(value) => {
          setNewSubjectName(value);
          setNewSubjectError("");
        }}
        newSubjectError={newSubjectError}
        subjects={subjects ?? []}
        titleError={titleError}
        maxTitle={MAX_TITLE}
        disabled={busy}
      />
      {error && <p className="deck-error" role="alert">{error}</p>}
    </Modal>
  );
}
