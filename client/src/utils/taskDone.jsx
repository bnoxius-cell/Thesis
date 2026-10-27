import { toast } from "react-toastify";

const DONE_TOASTS = ["Done. One less thing.", "Nice, that's off your plate.", "Finished. Take a breath before the next one."];

// The small encouragement after a task is ticked off, with Undo for a slipped tap (the row has left the
// list by then). Un-ticking says "Reopened." `onUndo` should reopen the task.
export const showDoneToast = (done, onUndo) => {
  if (!done) {
    toast.success("Reopened.");
    return;
  }
  const message = DONE_TOASTS[Math.floor(Math.random() * DONE_TOASTS.length)];
  toast.success(({ closeToast }) => (
    <span className="toast-with-action">
      <span>{message}</span>
      {onUndo && (
        <button type="button" className="toast-action" onClick={() => { closeToast(); onUndo(); }}>Undo</button>
      )}
    </span>
  ));
};

// How long a ticked row shows its "done" state before the list drops it, so the tick is seen.
export const DONE_SETTLE_MS = 280;
