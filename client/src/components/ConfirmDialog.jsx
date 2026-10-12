import { useRef } from "react";
import ModalShell from "./ModalShell";

// In-app replacement for window.confirm. `tone="danger"` is for destructive actions
// (delete, leave) and uses the clay color; everything else uses the normal button.
// `cancelLabel={null}` drops the cancel button, for a notice with a single "Done".
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null);

  return (
    <ModalShell
      open={Boolean(open)}
      onClose={onCancel}
      busy={busy}
      role="alertdialog"
      labelledBy="confirm-dialog-title"
      className="confirm-dialog"
      initialFocusRef={confirmRef}
    >
      <h2 id="confirm-dialog-title" className="confirm-dialog-title">{title}</h2>
      <div className="confirm-dialog-body">{children}</div>
      <div className="modal-actions">
        {cancelLabel !== null && (
          <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
        )}
        <button
          type="button"
          ref={confirmRef}
          className={tone === "danger" ? "primary-button confirm-danger" : "primary-button"}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Working..." : confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}
