import { toast } from "react-toastify";
import "./tasks.css";

const DONE_MESSAGES = ["Done. One less thing.", "Nice, that's off your plate.", "Finished. Take a breath before the next one."];

// A success toast with Undo, for a change the student may want back. The row has left the list by the
// time it shows, so a slipped tap is recoverable here.
export function showUndoToast(message, onUndo) {
  toast.success(({ closeToast }) => (
    <span className="tasks-toast">
      <span>{message}</span>
      <button
        type="button"
        className="tasks-toast__undo"
        onClick={() => {
          closeToast();
          onUndo();
        }}
      >
        Undo
      </button>
    </span>
  ));
}

// A small word of encouragement after a task is ticked off. Unticking just says "Reopened."
export function showDoneToast(onUndo) {
  showUndoToast(DONE_MESSAGES[Math.floor(Math.random() * DONE_MESSAGES.length)], onUndo);
}

export const showReopenedToast = () => toast.success("Reopened.");
