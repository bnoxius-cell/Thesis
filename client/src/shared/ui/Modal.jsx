import { useId, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import ModalShell from "./ModalShell";
import ConfirmDialog from "./ConfirmDialog";
import IconButton from "./IconButton";

// App-wide dialog (Figma 53:909). It lays out a title row with a close button, a scrolling body
// (the children) and an actions row, and gets the behaviour from ModalShell: Escape closes the
// top dialog only, a drag-select that ends on the overlay doesn't close it, focus moves in and
// back, Tab stays inside, no page scroll behind it.
// Props: `title` and `subtitle` (the title names the dialog), `actions` (the buttons, in reading
// order: Cancel first, the main one last), `open` (default true), `onClose`, `busy` (blocks every
// way of closing), `className`, `as="form"` to make the card a form (pass onSubmit), and
// `confirmClose`: a function that returns true when closing should first ask "Leave?" (wording
// through `leavePrompt`). Without a `title`, pass `labelledBy` for the id of your own heading.
// `sheet` makes it a bottom sheet on phones, the "Leave?" prompt too (see ModalShell). `actions` may be a
// function that gets `close`, so a Cancel button goes through the same "Leave?" check as the X.
// `onBack` draws a back arrow before the title (named by `backLabel`) for a dialog opened from another one.
export default function Modal({
  title,
  subtitle,
  actions,
  onClose,
  confirmClose,
  leavePrompt,
  onBack,
  backLabel = "Back",
  busy = false,
  sheet = false,
  labelledBy,
  children,
  ...rest
}) {
  const [asking, setAsking] = useState(false);
  const titleId = useId();

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
      <ModalShell onClose={close} busy={busy} sheet={sheet} labelledBy={title ? titleId : labelledBy} {...rest}>
        {title && (
          <div className="ui-modal__head">
            {onBack && <IconButton plain label={backLabel} icon={ArrowLeft} className="ui-modal__back" onClick={onBack} disabled={busy} />}
            <div className="ui-modal__titles">
              <h2 id={titleId} className="ui-modal__title">
                {title}
              </h2>
              {subtitle && <p className="ui-modal__subtitle">{subtitle}</p>}
            </div>
            <IconButton plain label="Close" icon={X} onClick={close} disabled={busy} />
          </div>
        )}
        <div className="ui-modal__body">{children}</div>
        {actions && <div className="ui-modal__actions">{typeof actions === "function" ? actions(close) : actions}</div>}
      </ModalShell>
      <ConfirmDialog
        open={asking}
        title={prompt.title}
        confirmLabel={prompt.confirmLabel}
        cancelLabel={prompt.cancelLabel}
        sheet={sheet}
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
