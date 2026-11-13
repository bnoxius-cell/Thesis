import { toast } from "react-toastify";

// A toast with one action button, for a change the student may want to follow up ("View"). The toast
// container sits outside the router, so `onAction` is a closure that brings its own navigate. The button
// closes the toast first, then runs the action. `type` is "success" (the default), "info" or "error".
export function showActionToast(message, { label, onAction, type = "success" }) {
  toast(
    ({ closeToast }) => (
      <span className="toast-with-action">
        <span>{message}</span>
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            closeToast();
            onAction();
          }}
        >
          {label}
        </button>
      </span>
    ),
    { type },
  );
}
