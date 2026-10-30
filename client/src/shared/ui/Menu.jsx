import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MenuContext } from "./menuContext";
import { computePlacement } from "./menuPosition";
import { nextIndex } from "./rovingKeys";
import "./menu.css";

const ITEMS = '[role="menuitem"], [role="menuitemradio"], [role="option"]';
const menuItems = (menu) => [...menu.querySelectorAll(ITEMS)].filter((el) => !el.disabled);

// An anchored popover. `trigger` is a function that gets the props to spread on the button that
// opens it: trigger={(props) => <button {...props}>Open</button>}. Children are MenuItem rows.
// role "menu" is for actions and links, "listbox" for choosing a value (SelectButton).
// Opens on click, ArrowDown or ArrowUp; arrows, Home and End move; Escape closes and returns
// focus to the trigger; Tab and a click outside close it. It renders in a portal with fixed
// position so a scrolling dialog can't clip it, and stays inside the viewport.
// align: start | end (which trigger edge it lines up with). matchWidth: at least as wide as the
// trigger. block: the anchor fills its row.
export default function Menu({
  trigger,
  children,
  role = "menu",
  align = "start",
  matchWidth = false,
  block = false,
  label,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  // Before paint: place the menu, then focus the chosen row (or the first).
  useLayoutEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const anchor = triggerRef.current.getBoundingClientRect();
    if (matchWidth) menu.style.minWidth = `${anchor.width}px`;
    const place = computePlacement({
      trigger: anchor,
      size: { width: menu.offsetWidth, height: menu.offsetHeight },
      viewport: { width: document.documentElement.clientWidth, height: window.innerHeight },
      align,
    });
    Object.assign(menu.style, {
      top: `${place.top}px`,
      left: `${place.left}px`,
      maxHeight: `${place.maxHeight}px`,
      transformOrigin: place.origin,
    });
    const items = menuItems(menu);
    const chosen = items.find(
      (el) => el.getAttribute("aria-selected") === "true" || el.getAttribute("aria-checked") === "true",
    );
    (chosen ?? items[0])?.focus({ preventScroll: true });
  }, [open, align, matchWidth]);

  useEffect(() => {
    if (!open) return undefined;
    // Capture phase on document: Escape closes only this menu, even inside a dialog that also
    // listens for Escape, because the event never reaches it.
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      } else if (e.key === "Tab") {
        close(); // focus returns to the trigger, then Tab moves on from there
      }
    };
    const onPointerDown = (e) => {
      if (!menuRef.current.contains(e.target) && !triggerRef.current.contains(e.target)) close(false);
    };
    // A fixed menu would drift away from its trigger, so a page scroll or resize closes it.
    const onScroll = (e) => {
      if (!menuRef.current.contains(e.target)) close(false);
    };
    const onResize = () => close(false);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  const onMenuKeyDown = (e) => {
    const items = menuItems(menuRef.current);
    const next = nextIndex(e.key, items.indexOf(document.activeElement), items.length, "vertical");
    if (next === null) return;
    e.preventDefault();
    items[next].focus();
  };

  const triggerProps = {
    ref: triggerRef,
    onClick: () => (open ? close() : setOpen(true)),
    onKeyDown: (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      setOpen(true);
    },
    "aria-haspopup": role,
    "aria-expanded": open,
    "aria-controls": open ? menuId : undefined,
  };

  return (
    <div className={`ui-menu-anchor ${block ? "ui-menu-anchor--block" : ""} ${className}`.trim()}>
      {trigger(triggerProps)}
      {open &&
        createPortal(
          <MenuContext.Provider value={{ role: role === "listbox" ? "option" : "menuitem", close }}>
            <div ref={menuRef} id={menuId} role={role} aria-label={label} className="ui-menu" onKeyDown={onMenuKeyDown}>
              {children}
            </div>
          </MenuContext.Provider>,
          document.body,
        )}
    </div>
  );
}
