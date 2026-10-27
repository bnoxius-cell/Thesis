import { useState, useRef, useEffect, useId } from "react";

// A button that opens a small list of actions under it. Closes on a pick, a click outside,
// or Escape, and the arrow keys move between items, like a native menu.
//
//   trigger     what the button shows (icon and text)
//   label       accessible name when the trigger is only an icon
//   children    (close) => the items. Use <MenuItem> for each action.
export default function Menu({ trigger, label, className = "secondary-button", align = "end", wide = false, children }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        wrapRef.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    // Focus the first action so the keyboard can take it from there.
    listRef.current?.querySelector("[role='menuitem']:not(:disabled), button:not(:disabled)")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // A pick closes the menu and may open a dialog. Focus goes back to the trigger first (capture
  // phase, before the item's own handler), so the dialog remembers the trigger rather than the
  // item that is about to unmount, and hands focus back to it on close.
  const onListClickCapture = (e) => {
    if (e.target.closest("[role='menuitem']")) wrapRef.current?.querySelector("button")?.focus({ preventScroll: true });
  };

  const onListKey = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...listRef.current.querySelectorAll("[role='menuitem']:not(:disabled)")];
    const at = items.indexOf(document.activeElement);
    const next = e.key === "ArrowDown" ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div className="sched-menu" ref={wrapRef}>
      <button
        type="button"
        className={className}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={id}
          ref={listRef}
          className={`sched-menu-list align-${align}${wide ? " is-wide" : ""}`}
          role="menu"
          onKeyDown={onListKey}
          onClickCapture={onListClickCapture}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon: Icon, children, hint, tone, onClick, disabled }) {
  return (
    <button type="button" role="menuitem" className={`sched-menu-item${tone ? ` is-${tone}` : ""}`} onClick={onClick} disabled={disabled}>
      {Icon && <Icon size={16} aria-hidden="true" />}
      <span>
        {children}
        {hint && <small>{hint}</small>}
      </span>
    </button>
  );
}
