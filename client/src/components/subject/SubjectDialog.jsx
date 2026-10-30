import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { Check, X } from "lucide-react";
import { useAuth } from "../../pages/authentication/AuthContext";
import { createSubjectRequest, updateSubjectRequest, deleteSubjectRequest } from "../../utils/subjectApi";
import { SUBJECT_COLORS, linkedMessage, nextSubjectColor } from "../../utils/subjectColors";
import Modal from "../Modal";
import ConfirmDialog from "../ConfirmDialog";
import BusySpinner from "../BusySpinner";
import "../../styles/pages/subjects.css";

// Add or edit a subject: name, code, term and colour. Editing also offers Delete.
//
//   subject     set when editing
//   initial     { name, code } to start a new subject with (from a suggestion or an old course label)
//   subjects    the student's current subjects, so a new one starts on a colour nobody uses
//   onSaved     ({ subject, linked, created }) after a successful save
//   onDeleted   (subject) after a successful delete
//
// It can open on top of another dialog (the task form), so it renders into <body> and keeps its
// submit from reaching the form underneath.
export default function SubjectDialog({ subject, initial, subjects = [], onClose, onSaved, onDeleted }) {
  const { backendUrl } = useAuth();
  const [form, setForm] = useState(() => ({
    name: subject?.name ?? initial?.name ?? "",
    code: subject?.code ?? initial?.code ?? "",
    term: subject?.term ?? "",
    color: subject?.color ?? nextSubjectColor(subjects),
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!form.name.trim()) return setError("Give the subject a name.");
    setSaving(true);
    const body = { name: form.name, code: form.code, term: form.term, color: form.color };
    const { data, error: message } = subject
      ? await updateSubjectRequest(backendUrl, subject._id, body)
      : await createSubjectRequest(backendUrl, body);
    setSaving(false);
    if (message) return setError(message);
    const note = linkedMessage(data.linked);
    toast.success(subject ? `Saved. ${note}`.trim() : `Subject added. ${note}`.trim());
    return onSaved?.({ subject: data.subject, linked: data.linked, created: !subject });
  };

  const remove = async () => {
    setSaving(true);
    const { error: message } = await deleteSubjectRequest(backendUrl, subject._id);
    setSaving(false);
    setConfirmDelete(false);
    if (message) return setError(message);
    toast.success("Subject deleted.");
    return onDeleted?.(subject);
  };

  const counts = subject?.counts;
  const keeps = counts && (counts.openTasks > 0 || counts.reviewers > 0);

  return createPortal(
    <>
      <Modal onClose={onClose} busy={saving} as="form" noValidate className="sched-modal sched-modal-narrow subject-dialog" labelledBy="subject-dialog-title" onSubmit={submit}>
        <div className="modal-header">
          <h2 id="subject-dialog-title">{subject ? "Edit subject" : "New subject"}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        <div className="form-grid">
          <div className="form-group full-span">
            <label htmlFor="subject-name">Name</label>
            <input id="subject-name" type="text" value={form.name} maxLength={80} autoComplete="off" onChange={(e) => set({ name: e.target.value })} placeholder="e.g., Data Structures" />
          </div>
          <div className="form-group">
            <label htmlFor="subject-code">Code (optional)</label>
            <input id="subject-code" type="text" value={form.code} maxLength={20} autoComplete="off" onChange={(e) => set({ code: e.target.value })} placeholder="IT 301" />
          </div>
          <div className="form-group">
            <label htmlFor="subject-term">Term (optional)</label>
            <input id="subject-term" type="text" value={form.term} maxLength={40} autoComplete="off" onChange={(e) => set({ term: e.target.value })} placeholder="1st sem 2026-27" />
          </div>
          <div className="form-group full-span">
            <span className="sched-field-label" id="subject-color-label">Colour</span>
            <div className="subject-swatches" role="radiogroup" aria-labelledby="subject-color-label">
              {SUBJECT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={form.color === color}
                  aria-label={color}
                  className="subject-swatch"
                  style={{ "--dot": `var(--subject-${color})` }}
                  onClick={() => set({ color })}
                >
                  {form.color === color && <Check size={16} aria-hidden="true" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="modal-actions sched-modal-actions">
          {subject && (
            <button type="button" className="ghost-button is-danger" onClick={() => setConfirmDelete(true)} disabled={saving}>Delete</button>
          )}
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="primary-button" disabled={saving} aria-busy={saving}>{saving && <BusySpinner />}
            {saving ? "Saving..." : subject ? "Save changes" : "Add subject"}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${subject?.name}?`}
        confirmLabel="Delete"
        tone="danger"
        busy={saving}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      >
        {keeps
          ? "Your tasks and reviewers for it stay, with the class name as a plain label. They just won't be grouped under this subject anymore."
          : "Nothing is linked to it right now."}
      </ConfirmDialog>
    </>,
    document.body,
  );
}
