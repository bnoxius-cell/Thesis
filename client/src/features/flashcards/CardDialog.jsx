import { useState } from "react";
import { Button, Modal } from "@/shared/ui";
import CardForm from "./CardForm";
import "./deck.css";

// Edit card (Figma 261:1671, 261:1801): a dialog on desktop, a sheet on phones. `onSave(fields)` answers
// { error } or not; a failed save keeps the dialog open with the server's message.
export default function CardDialog({ card, onSave, onClose }) {
  const [fields, setFields] = useState({ term: card.term, answer: card.answer });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changed = fields.term !== card.term || fields.answer !== card.answer;
  const ready = fields.term.trim() !== "" && fields.answer.trim() !== "";

  const submit = async (event) => {
    event.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setError("");
    const { error: failure } = await onSave({ term: fields.term.trim(), answer: fields.answer.trim() });
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
      title="Edit card"
      busy={busy}
      onClose={onClose}
      confirmClose={() => changed}
      actions={<Button type="submit" busy={busy} disabled={!ready}>Save</Button>}
    >
      <CardForm term={fields.term} answer={fields.answer} onChange={(part) => setFields((prev) => ({ ...prev, ...part }))} disabled={busy} autoFocus />
      {error && <p className="deck-error" role="alert">{error}</p>}
    </Modal>
  );
}
