import { useId, useRef } from "react";
import ModalShell from "./ModalShell";
import Button from "./Button";

// In-app replacement for window.confirm. `tone="danger"` is for destructive actions (delete,
// leave) and uses the danger Button; everything else uses the primary one. The confirm button
// gets focus on open and Escape cancels. `cancelLabel={null}` drops the cancel button, for a
// notice with a single "Done". `sheet` makes it a bottom sheet on phones (see ModalShell). `className` is added to the card.
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
  sheet = false,
  className = "",
}) {
  const confirmRef = useRef(null);
  const titleId = useId();

  return (
    <ModalShell
      open={Boolean(open)}
      onClose={onCancel}
      busy={busy}
      role="alertdialog"
      labelledBy={titleId}
      className={`ui-modal--confirm ${className}`.trim()}
      initialFocusRef={confirmRef}
      sheet={sheet}
    >
      <div className="ui-modal__head">
        <h2 id={titleId} className="ui-modal__title">
          {title}
        </h2>
      </div>
      <div className="ui-modal__body ui-modal__body--text">{children}</div>
      <div className="ui-modal__actions">
        {cancelLabel !== null && (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
        )}
        <Button ref={confirmRef} variant={tone === "danger" ? "danger" : "primary"} busy={busy} onClick={onConfirm}>
          {busy ? "Working..." : confirmLabel}
        </Button>
      </div>
    </ModalShell>
  );
}
