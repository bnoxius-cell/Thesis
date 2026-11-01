import { useState } from "react";
import ModalShell from "./ModalShell";
import ConfirmDialog from "./ConfirmDialog";

// App-wide dialog. Same markup and styles as before (.modal-overlay / .modal-content), plus
// shared behaviour (see ModalShell): Escape closes the top dialog only, a drag-select that
// ends on the overlay doesn't close it, focus moves in and back, Tab stays inside, no page
// scroll behind it. Props: `open` (default true), `onClose`, `labelledBy`, `busy` (blocks
// closing), `className`, `as="form"` for a form dialog, and `confirmClose`: a function that
// returns true when closing should first ask "Leave?" (wording via `leavePrompt`).
export default function Modal({ onClose, confirmClose, leavePrompt, children, ...rest }) {
  const [asking, setAsking] = useState(false);

  const close = () => {
    if (confirmClose && confirmClose()) setAsking(true);
    else onClose?.();
  };

  const prompt = {
    title: "Leave without saving?",
    body: "What you've entered so far won't be saved.",
    confirmLabel: "Leave",
    cancelLabel: "Keep editing",
    ...leavePrompt,
  };

  return (
    <>
      <ModalShell onClose={close} {...rest}>
        {children}
      </ModalShell>
      <ConfirmDialog
        open={asking}
        title={prompt.title}
        confirmLabel={prompt.confirmLabel}
        cancelLabel={prompt.cancelLabel}
        tone="danger"
        onConfirm={() => {
          setAsking(false);
          onClose?.();
        }}
        onCancel={() => setAsking(false)}
      >
        {prompt.body}
      </ConfirmDialog>
    </>
  );
}
