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

// Keyboard focus after a row leaves the list. When the focused done box is about to disappear, pick
// where focus should go: the next row's box, else the one above, else the quick-add title.
export function focusTargetAfter(button) {
  const row = button.closest("li");
  const boxOf = (li) => li?.querySelector(".task-check");
  return boxOf(row?.nextElementSibling) || boxOf(row?.previousElementSibling) || null;
}

// Called once the row is gone (or back): put focus on the target if it is still there, else the quick-add
// title, else <main>, so it never drops to <body>.
export function restoreFocus(target) {
  requestAnimationFrame(() => {
    const el = target?.isConnected ? target : document.querySelector(".quick-add-input") || document.getElementById("main");
    el?.focus({ preventScroll: true });
  });
}

// After Undo brings a task back, focus its done box once it has rendered.
export function focusTaskCheck(taskId) {
  setTimeout(() => {
    const box = document.querySelector(`.task-check[data-task-id="${taskId}"]`);
    (box || document.querySelector(".quick-add-input") || document.getElementById("main"))?.focus({ preventScroll: true });
  }, 60);
}
