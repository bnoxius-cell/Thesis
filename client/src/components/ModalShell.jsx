import { useCallback, useEffect, useRef, useState } from "react";

// The dialog shell. Use Modal (or ConfirmDialog), which build on this.
// The one dialog shell for the app. It renders the existing .modal-overlay / .modal-content
// markup, so nothing looks different, and adds the behaviour every dialog should share:
// Escape closes only the top-most dialog, an overlay click closes only when the press
// started on the overlay too (selecting text and releasing outside no longer closes it),
// focus moves in and comes back, Tab stays inside, and the page doesn't scroll behind it.
//
// `as="form"` makes the content element a <form> (pass onSubmit through as usual).
// `busy` blocks every way of closing. `confirmClose` is a function that returns true when
// closing should ask first; Modal.jsx adds that question.

const stack = [];
let lockCount = 0;
let savedOverflow = "";

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

function lockScroll() {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
}

function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.style.overflow = savedOverflow;
}

function visibleFocusables(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter(
    (el) => !el.disabled && el.getAttribute("aria-hidden") !== "true" && el.getClientRects().length > 0,
  );
}

export default function ModalShell({
  open = true,
  onClose,
  labelledBy,
  busy = false,
  className = "",
  overlayClassName = "",
  as: Tag = "div",
  role = "dialog",
  initialFocusRef,
  children,
  ...rest
}) {
  const contentRef = useRef(null);
  const pressedOverlay = useRef(false);
  const latest = useRef({});
  // The element that had focus when the dialog opened. It is read while rendering, before the
  // commit that lets an autofocused field take focus, so focus can go back to the real opener.
  const [opener, setOpener] = useState(null);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    setOpener(open ? document.activeElement : null);
  }
  useEffect(() => {
    latest.current = { onClose, busy };
  });

  const requestClose = useCallback(() => {
    const { onClose: close, busy: isBusy } = latest.current;
    if (!isBusy) close?.();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const token = {};
    stack.push(token);
    lockScroll();

    const root = contentRef.current;
    if (root && !root.contains(document.activeElement)) {
      const target =
        initialFocusRef?.current ||
        root.querySelector("input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled)") ||
        root;
      target.focus({ preventScroll: true });
    }

    const onKeyDown = (e) => {
      if (e.key !== "Escape" || stack[stack.length - 1] !== token) return;
      e.stopPropagation();
      requestClose();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const at = stack.indexOf(token);
      if (at >= 0) stack.splice(at, 1);
      unlockScroll();
      if (opener && opener !== document.body && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [open, requestClose, initialFocusRef, opener]);

  if (!open) return null;

  const onContentKeyDown = (e) => {
    if (e.key !== "Tab") return;
    const root = contentRef.current;
    const items = visibleFocusables(root);
    if (items.length === 0) {
      e.preventDefault();
      root.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === root)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className={`modal-overlay ${overlayClassName}`.trim()}
      onPointerDown={(e) => {
        pressedOverlay.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        const startedHere = pressedOverlay.current;
        pressedOverlay.current = false;
        if (startedHere && e.target === e.currentTarget) requestClose();
      }}
    >
      <Tag
        ref={contentRef}
        className={`modal-content ${className}`.trim()}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={onContentKeyDown}
        {...rest}
      >
        {children}
      </Tag>
    </div>
  );
}
