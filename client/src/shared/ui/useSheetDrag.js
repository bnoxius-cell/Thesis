import { useCallback, useEffect, useRef } from "react";

// Drag-to-close for a phone bottom sheet (ModalShell wires it up). Spread the returned handlers on
// the sheet card. A drag that starts on the grab handle or the title row (never on a button or
// field, and never in the scrolling body, so scrolling is untouched) pulls the card down 1:1 with
// transform only and never above its resting spot. On release it closes when it was pulled past
// about a third of its height or flicked down, otherwise it springs back. A close goes through the
// dialog's own close path (`onClose`, which already checks `busy` and "Leave?"); if the dialog is
// still on screen afterwards (refused, or the prompt opened) the card slides back. The backdrop
// fades through --sheet-drag on the overlay (see modal.css). A new touch during a settle takes
// over from where the card is. With reduced motion there is no slide, the card jumps instead.

const PHONE = "(max-width: 719.98px)"; // the same breakpoint as the sheet in modal.css
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const DRAG_AREA = ".ui-modal__handle, .ui-modal__head";
const CONTROLS = "button, a, input, select, textarea, [role='button']";
const CLOSE_FRACTION = 0.35;
const FLICK_PX_PER_MS = 0.5;
const FLICK_WINDOW_MS = 100; // a pause before letting go cancels the flick
const GRAB_SLOP_PX = 4;
const SNAP_MS = 240;
const EXIT_MS = 180;
const REFUSED_CHECK_MS = 60; // how long to wait for the dialog to unmount before sliding back

// Where the card is on screen right now, so a new touch can pick it up mid-settle.
const liveOffset = (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42;

export default function useSheetDrag({ enabled, contentRef, overlayRef, busy, onClose }) {
  const drag = useRef(null);
  const timer = useRef(0);
  const latest = useRef({});
  useEffect(() => {
    latest.current = { enabled, busy, onClose };
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  const paint = (el, offset) => {
    el.style.transform = offset ? `translateY(${offset}px)` : "";
    overlayRef.current?.style.setProperty("--sheet-drag", String(Math.min(1, offset / el.offsetHeight)));
  };

  // Moves the card to `offset` over `ms` (the backdrop follows), then runs `done`.
  const settle = (el, offset, ms, done) => {
    const length = window.matchMedia(REDUCED_MOTION).matches ? 0 : ms;
    el.style.transition = length ? `transform ${length}ms var(--ease-out)` : "none";
    if (overlayRef.current) overlayRef.current.style.transition = length ? `--sheet-drag ${length}ms var(--ease-out)` : "none";
    paint(el, offset);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (offset === 0) {
        el.style.transition = "";
        el.style.transform = "";
        overlayRef.current?.style.removeProperty("--sheet-drag");
        if (overlayRef.current) overlayRef.current.style.transition = "";
      }
      done?.();
    }, length);
  };

  const onPointerDown = useCallback(
    (e) => {
      const { enabled: on, busy: isBusy } = latest.current;
      const el = contentRef.current;
      if (!on || isBusy || !el || drag.current || !e.isPrimary || !window.matchMedia(PHONE).matches) return;
      if (e.button > 0 || !e.target.closest(DRAG_AREA) || e.target.closest(CONTROLS)) return;
      clearTimeout(timer.current); // a settle in progress: take over from where the card is
      const offset = Math.max(0, liveOffset(el));
      el.style.animation = "none";
      el.style.transition = "none";
      if (overlayRef.current) overlayRef.current.style.transition = "none";
      paint(el, offset);
      drag.current = { id: e.pointerId, startY: e.clientY - offset, offset, grabbed: false, velocity: 0, lastY: e.clientY, lastT: e.timeStamp };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contentRef, overlayRef],
  );

  const onPointerMove = useCallback(
    (e) => {
      const d = drag.current;
      const el = contentRef.current;
      if (!d || e.pointerId !== d.id || !el) return;
      if (!d.grabbed) {
        if (Math.abs(e.clientY - d.lastY) < GRAB_SLOP_PX) return;
        d.grabbed = true;
        el.setPointerCapture(e.pointerId);
      }
      const dt = e.timeStamp - d.lastT;
      if (dt > 0) d.velocity = 0.6 * ((e.clientY - d.lastY) / dt) + 0.4 * d.velocity;
      d.lastY = e.clientY;
      d.lastT = e.timeStamp;
      d.offset = Math.max(0, e.clientY - d.startY);
      paint(el, d.offset);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contentRef, overlayRef],
  );

  const finish = useCallback(
    (e, cancelled) => {
      const d = drag.current;
      const el = contentRef.current;
      if (!d || e.pointerId !== d.id || !el) return;
      drag.current = null;
      const height = el.offsetHeight;
      const flicked = e.timeStamp - d.lastT < FLICK_WINDOW_MS && d.velocity > FLICK_PX_PER_MS;
      if (cancelled || !d.grabbed || (d.offset < height * CLOSE_FRACTION && !flicked)) {
        settle(el, 0, d.offset ? SNAP_MS : 0);
        return;
      }
      settle(el, height, EXIT_MS, () => {
        latest.current.onClose?.();
        // Still mounted a moment later: the close was refused or the "Leave?" prompt opened.
        timer.current = setTimeout(() => el.isConnected && settle(el, 0, SNAP_MS), REFUSED_CHECK_MS);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contentRef, overlayRef],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: (e) => finish(e, false),
    onPointerCancel: (e) => finish(e, true),
  };
}
