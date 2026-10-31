import { toast } from "react-toastify";
import "./tasks.css";

const DONE_MESSAGES = ["Done. One less thing.", "Nice, that's off your plate.", "Finished. Take a breath before the next one."];

// A small word of encouragement after a task is ticked off, with Undo for a slipped tap (the row has
// left the list by then). Unticking just says "Reopened."
export function showDoneToast(onUndo) {
  const message = DONE_MESSAGES[Math.floor(Math.random() * DONE_MESSAGES.length)];
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

export const showReopenedToast = () => toast.success("Reopened.");
