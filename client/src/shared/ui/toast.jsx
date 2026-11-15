import { useEffect } from "react";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { cssTransition, toast } from "react-toastify";

// The site toast's pieces (container props are in App.jsx, look and position in styles/components.css).

// The icon is the only thing that tells the type apart: every toast is the same dark pill.
// react-toastify calls this with { type }, which is "success", "error", "warning", "info" or "default".
const ICONS = { success: CircleCheck, error: CircleAlert, warning: CircleAlert };
export function ToastIcon({ type }) {
  const Icon = ICONS[type] ?? Info;
  return <Icon size={20} aria-hidden="true" />;
}

// Rises 8px and fades in, fades out faster. The animations are in motion.css, set up in components.css.
export const toastTransition = cssTransition({ enter: "toast-enter", exit: "toast-exit", collapseDuration: 100 });

// A toast with one action button, for a change the student may want to follow up ("View", "Undo"). The
// toast container sits outside the router, so `onAction` is a closure that brings its own navigate. The
// button closes the toast first, then runs the action. `type` is "success" (the default), "info" or "error".
export function showActionToast(message, { label, onAction, type = "success" }) {
  toast(
    ({ closeToast }) => (
      <span className="toast-with-action">
        <span>{message}</span>
        <button
          type="button"
          className="toast-action"
          onClick={(event) => {
            event.stopPropagation(); // the toast's own tap-to-dismiss would close it a second time
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

// react-toastify pauses a toast's timer on hover and when the window loses focus, but not when keyboard
// focus lands in it. Call once, in App: pauses the toast that holds focus and resumes it when focus leaves.
export function useToastFocusPause() {
  useEffect(() => {
    const toastOf = (node) => node?.closest?.(".Toastify__toast");
    const onFocusIn = (event) => {
      const el = toastOf(event.target);
      if (el?.id) toast.pause({ id: el.id });
    };
    const onFocusOut = (event) => {
      const el = toastOf(event.target);
      if (el?.id && toastOf(event.relatedTarget) !== el) toast.play({ id: el.id });
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
}
