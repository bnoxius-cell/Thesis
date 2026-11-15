import { useCallback, useEffect, useRef, useState } from "react";
import { prefersLessMotion } from "@/utils/motion";

// Swipe-left-to-delete for one inbox row on a touch screen. Spread `handlers` and `slideRef` on the
// element that holds the row (the slide) and `itemRef` on the box around it (it also holds the red
// Delete action behind the slide). Only a touch that moves sideways takes over; a mostly vertical
// one is left to the browser, so the list always scrolls (the slide has touch-action: pan-y).
//   Past 40% of the width, or a quick flick left, deletes: the row slides out and the gap closes.
//   Dragged about half way it rests open on the 88px Delete action (tap it to delete); anything
//   less springs back shut. A new touch during a settle picks the row up where it is.
// A drag never opens the row's link: the click that can follow it is swallowed, and while the row is
// open a tap on it only closes it. With reduced motion nothing slides, the row is just removed.
const REVEAL_PX = 88;
const START_SLOP_PX = 8; // how far a touch moves before we decide which way it is going
const DELETE_FRACTION = 0.4;
const FLICK_PX_PER_MS = 0.5;
const FLICK_WINDOW_MS = 100; // a pause before letting go cancels the flick
const FRICTION = 0.25; // pulling right past closed
const SNAP_MS = 220;
const EXIT_MS = 180;
const CLICK_GUARD_MS = 300; // how long after a drag a stray click is still swallowed

// Where the slide is on screen right now.
const liveX = (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41;

export default function useSwipeToDelete({ onDelete }) {
  const itemRef = useRef(null);
  const slideRef = useRef(null);
  const gesture = useRef(null);
  const swiped = useRef(false);
  const leavingRef = useRef(false);
  const timer = useRef(0);
  const clickTimer = useRef(0);
  const latest = useRef(onDelete);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    latest.current = onDelete;
  });
  useEffect(() => () => clearTimeout(clickTimer.current), []);

  const paint = (x, ms) => {
    const slide = slideRef.current;
    if (!slide) return;
    slide.style.transition = ms ? `transform ${ms}ms var(--ease-out)` : "none";
    slide.style.transform = x ? `translateX(${typeof x === "number" ? `${x}px` : x})` : "";
  };

  const rest = useCallback((x) => {
    const ms = prefersLessMotion() ? 0 : SNAP_MS;
    paint(x, ms);
    setOpen(x !== 0);
    clearTimeout(timer.current);
    if (x === 0) timer.current = setTimeout(() => itemRef.current?.removeAttribute("data-swipe"), ms);
  }, []);

  const leave = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    if (prefersLessMotion()) {
      latest.current();
      return;
    }
    setLeaving(true);
    paint("-100%", EXIT_MS);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => latest.current(), EXIT_MS);
  }, []);

  // While the row is open, a touch anywhere else closes it.
  useEffect(() => {
    if (!open) return undefined;
    const closeIfOutside = (e) => {
      if (!itemRef.current?.contains(e.target)) rest(0);
    };
    document.addEventListener("pointerdown", closeIfOutside, true);
    return () => document.removeEventListener("pointerdown", closeIfOutside, true);
  }, [open, rest]);

  const onPointerDown = (e) => {
    const slide = slideRef.current;
    if (e.pointerType !== "touch" || !e.isPrimary || gesture.current || leavingRef.current || !slide) return;
    clearTimeout(timer.current); // a settle in progress: take over from where the row is
    swiped.current = false;
    const base = liveX(slide);
    paint(base, 0);
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, base, pos: base, mode: "pending", v: 0, lastX: e.clientX, lastT: e.timeStamp };
  };

  const onPointerMove = (e) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.id || g.mode === "ignore") return;
    const dx = e.clientX - g.x;
    if (g.mode === "pending") {
      const dy = e.clientY - g.y;
      if (Math.hypot(dx, dy) < START_SLOP_PX) return;
      // Mostly vertical, or pulling a closed row to the right: not ours, the browser scrolls.
      if (Math.abs(dy) > Math.abs(dx) || (g.base > -1 && dx > 0)) {
        g.mode = "ignore";
        return;
      }
      g.mode = "swipe";
      swiped.current = true;
      slideRef.current.setPointerCapture(e.pointerId);
      itemRef.current.setAttribute("data-swipe", "");
    }
    const dt = e.timeStamp - g.lastT;
    if (dt > 0) g.v = 0.6 * ((e.clientX - g.lastX) / dt) + 0.4 * g.v;
    g.lastX = e.clientX;
    g.lastT = e.timeStamp;
    const raw = g.base + dx;
    g.pos = raw > 0 ? raw * FRICTION : Math.max(raw, -slideRef.current.offsetWidth);
    paint(g.pos, 0);
  };

  const finish = (e, cancelled) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.id) return;
    gesture.current = null;
    if (g.mode !== "swipe") {
      if (slideRef.current) slideRef.current.style.transition = "";
      return;
    }
    clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      swiped.current = false;
    }, CLICK_GUARD_MS);
    const flick = !cancelled && e.timeStamp - g.lastT < FLICK_WINDOW_MS ? g.v : 0;
    const farEnough = g.pos <= -slideRef.current.offsetWidth * DELETE_FRACTION;
    if (!cancelled && (farEnough || (flick < -FLICK_PX_PER_MS && g.pos < -REVEAL_PX / 2))) {
      leave();
      return;
    }
    let opens = g.pos < -REVEAL_PX / 2;
    if (flick < -FLICK_PX_PER_MS) opens = g.pos < 0;
    else if (flick > FLICK_PX_PER_MS) opens = false;
    rest(opens ? -REVEAL_PX : 0);
  };

  const onClickCapture = (e) => {
    if (!swiped.current && !open) return;
    e.preventDefault();
    e.stopPropagation();
    if (!swiped.current) rest(0); // a tap on an open row only closes it
  };

  return {
    itemRef,
    slideRef,
    leaving,
    leave,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e) => finish(e, false),
      onPointerCancel: (e) => finish(e, true),
      onClickCapture,
    },
  };
}
