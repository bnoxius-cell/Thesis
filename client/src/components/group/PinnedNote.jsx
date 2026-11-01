import { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Pin, Pencil, ChevronDown, X } from "lucide-react";
import { useAuth } from "../../pages/authentication/AuthContext";
import Modal from "../Modal";
import BusySpinner from "../BusySpinner";

export const PINNED_MAX = 280;
const LONG_NOTE = 90; // roughly where two lines run out on a phone

// The group's pinned note: one bar under the group's name, above both tabs. Everyone can read it;
// admins also get Edit. The text shows two lines and opens fully when tapped. Nothing renders
// when there is no note (admins pin one from Group settings).
export default function PinnedNote({ group, isAdmin, onEdit }) {
  const [open, setOpen] = useState(false);
  const pinned = group.pinned;
  if (!pinned?.text) return null;
  const long = pinned.text.length > LONG_NOTE;

  return (
    <div className="pinned-note" data-tour="group-pinned">
      <Pin size={16} aria-hidden="true" className="pinned-icon" />
      <div className="pinned-body">
        {long ? (
          <button type="button" className="pinned-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <span className={`pinned-text${open ? " is-open" : ""}`}>
              <span className="sr-only">Pinned note: </span>
              {pinned.text}
            </span>
            <ChevronDown size={16} aria-hidden="true" className="pinned-chevron" />
          </button>
        ) : (
          <p className="pinned-text">
            <span className="sr-only">Pinned note: </span>
            {pinned.text}
          </p>
        )}
        {pinned.by?.name && <span className="pinned-by">Pinned by {pinned.by.name}</span>}
      </div>
      {isAdmin && (
        <button type="button" className="ghost-button small pinned-edit" onClick={onEdit}>
          <Pencil size={14} aria-hidden="true" /> Edit<span className="sr-only"> pinned note</span>
        </button>
      )}
    </div>
  );
}

// Write, change or clear the note. Admins only; the server checks that too.
export function PinnedNoteDialog({ group, onClose, onGroupUpdated }) {
  const { backendUrl } = useAuth();
  const existing = group.pinned?.text || "";
  const [text, setText] = useState(existing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (next, doneMessage) => {
    setBusy(true);
    setError("");
    try {
      const { data } = await axios.patch(`${backendUrl}/api/groups/${group._id}`, { pinned: next }, { withCredentials: true });
      if (data.success) {
        onGroupUpdated(data.group);
        toast.success(doneMessage);
        onClose();
      } else {
        setError(data.message || "Couldn't save the note.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't save the note. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const next = text.trim();
    if (!next) {
      setError("Write a note, or use Clear to remove the pinned one.");
      return;
    }
    if (next === existing) {
      onClose();
      return;
    }
    save(next, "Note pinned.");
  };

  return (
    <Modal
      onClose={onClose}
      busy={busy}
      as="form"
      onSubmit={submit}
      labelledBy="pinned-title"
      confirmClose={() => text.trim() !== existing}
    >
      <div className="modal-header">
        <h2 id="pinned-title">{existing ? "Edit pinned note" : "Pin a note"}</h2>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
      </div>
      <div className="pinned-form">
        <label htmlFor="pinned-text">Shown to everyone at the top of the group</label>
        <textarea
          id="pinned-text"
          rows={4}
          value={text}
          maxLength={PINNED_MAX}
          autoFocus
          onChange={(e) => { setText(e.target.value); setError(""); }}
          placeholder="e.g., Midterm review Friday 3pm, room 402"
        />
        <small className="field-hint pinned-count">{text.length}/{PINNED_MAX}</small>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions pinned-actions">
          {existing && (
            <button type="button" className="ghost-button is-danger pinned-clear" disabled={busy} onClick={() => save("", "Note cleared.")}>
              Clear note
            </button>
          )}
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="primary-button" disabled={busy} aria-busy={busy}>
            {busy && <BusySpinner />}
            {busy ? "Saving..." : "Pin note"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
