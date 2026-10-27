import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useAuth } from "../pages/authentication/AuthContext";
import { useGuide } from "../context/guideState";

// The page Guide: a short, step by step walkthrough of the page. A step's `target` names a
// `data-tour` attribute on the page: the guide scrolls to it and outlines it. Steps whose target isn't
// on screen (a section that only shows once there's data, or the other view of the page) are left out,
// so the guide matches what the student sees.
//
// This component only renders the panel. The button that opens it lives in the header (Header.jsx,
// `data-guide-trigger`) and talks to it through GuideContext; AppShell renders one PageTour per page.
// The first time a student visits a page the guide opens by itself (once per page per account, remembered
// in this browser); after that it only opens from the header button.

const HIGHLIGHT = "tour-target";
const LEAVE_MS = 140; // matches --dur-1, the exit transition in components.css
const seenKey = (userId, page) => `stresscare:tour-seen:${userId || "guest"}:${page}`;

function isSeen(key) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return true; // storage blocked: never auto-open, it could not be remembered
  }
}

function markSeen(key) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Private mode or blocked storage: nothing else breaks.
  }
}

function findTarget(target) {
  return target ? document.querySelector(`[data-tour="${target}"]`) : null;
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// The header button that is on screen (the sidebar one on laptops, the top bar one on phones).
function visibleTrigger() {
  return [...document.querySelectorAll("[data-guide-trigger]")].find((el) => el.offsetParent !== null) || null;
}

// Brings a section into the part of the screen the guide doesn't cover: everything above the
// bottom sheet on phones, the whole window on wider screens. A section that fits is centred in
// that space, a taller one starts at the top, and one that's already in view isn't moved.
function scrollToTarget(el, panel) {
  const isSheet = window.matchMedia?.("(max-width: 720px)").matches;
  const margin = isSheet ? 16 : 24;
  const room = window.innerHeight - (isSheet && panel ? panel.offsetHeight + 8 : 0);
  const rect = el.getBoundingClientRect();
  const fits = rect.height + margin * 2 <= room;
  if (fits && rect.top >= margin && rect.bottom <= room - margin) return;
  const offset = fits ? (room - rect.height) / 2 : margin;
  window.scrollTo({
    top: Math.max(0, window.scrollY + rect.top - offset),
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}

export default function PageTour({ page, title, steps }) {
  const { user } = useAuth();
  const { isOpen, setIsOpen, register } = useGuide();
  const key = seenKey(user?._id, page);
  const [visibleSteps, setVisibleSteps] = useState([]);
  const [index, setIndex] = useState(0);
  const [wasOpen, setWasOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const panelRef = useRef(null);
  const headingRef = useRef(null);
  // An automatic opening shouldn't pull keyboard focus off the page; a student's own click should.
  const focusHeading = useRef(true);

  // Opens the guide on the steps whose section is on screen. Returns false when there is nothing to show.
  const start = useCallback(
    ({ auto = false } = {}) => {
      const available = steps.filter((step) => !step.target || findTarget(step.target));
      if (!available.length) return false;
      focusHeading.current = !auto;
      setVisibleSteps(available);
      setIndex(0);
      setIsOpen(true);
      markSeen(key);
      return true;
    },
    [steps, key, setIsOpen],
  );

  // Tell the header this page has a Guide, and take it back when the page goes away.
  useEffect(() => register({ page, title }, start), [register, page, title, start]);

  // First visit: open by itself once the first step's section exists and no dialog is in the way.
  // Looks every 200ms. A dialog in the way is waited out for as long as it stays open; only the wait for
  // the section itself gives up, after 4 seconds (the next visit tries again). Opening (or having opened)
  // the guide marks the page as seen, which ends the polling.
  useEffect(() => {
    if (isSeen(key)) return undefined;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (isSeen(key)) {
        clearInterval(timer);
        return;
      }
      if (document.querySelector('[role="dialog"]:not(.tour-panel), .modal-overlay')) {
        tries -= 1; // not the page's fault: don't count the wait
        return;
      }
      const ready = steps.some((step) => !step.target || findTarget(step.target));
      if (ready) {
        clearInterval(timer);
        start({ auto: true });
      } else if (tries >= 20) {
        clearInterval(timer);
      }
    }, 200);
    return () => clearInterval(timer);
  }, [key, steps, start]);

  // Keep the panel mounted for the length of its exit transition. Set while rendering (the
  // "previous value" pattern), so there is no extra frame with the panel in the wrong state.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    setLeaving(!isOpen);
  }
  useEffect(() => {
    if (!leaving) return undefined;
    const timer = setTimeout(() => setLeaving(false), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  // Closing from inside the panel puts focus back on the header button. Closing from the button itself,
  // or from an automatic opening the student never touched, leaves focus where it is.
  const close = useCallback(() => {
    const insidePanel = panelRef.current?.contains(document.activeElement);
    setIsOpen(false);
    if (insidePanel) visibleTrigger()?.focus({ preventScroll: true });
  }, [setIsOpen]);

  const go = useCallback((delta) => {
    focusHeading.current = true;
    setIndex((i) => i + delta);
  }, []);

  const step = isOpen ? visibleSteps[index] : null;
  const isLast = index === visibleSteps.length - 1;
  const showPanel = isOpen ? !!step : leaving && !!visibleSteps[index];
  const shown = step || visibleSteps[index];

  // Outline the current step's section and bring it into view. Looked up again on every step,
  // so a section that went away while the guide was open just isn't outlined.
  useEffect(() => {
    if (!step) return undefined;
    if (focusHeading.current) headingRef.current?.focus({ preventScroll: true });
    const el = findTarget(step.target);
    if (!el) return undefined;
    el.classList.add(HIGHLIGHT);
    scrollToTarget(el, panelRef.current);
    return () => el.classList.remove(HIGHLIGHT);
  }, [step]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      // A dialog opened on top of the guide handles its own keys.
      if (document.querySelector(".modal-overlay")) return;
      if (e.key === "Escape") {
        close();
        return;
      }
      // Arrows only while the guide has focus, so they never fight the page's own controls.
      if (!panelRef.current?.contains(e.target)) return;
      if (e.key === "ArrowRight" && !isLast) go(1);
      if (e.key === "ArrowLeft" && index > 0) go(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, close, go, isLast, index]);

  if (!showPanel) return null;

  return (
    <section
      ref={panelRef}
      className={`tour-panel${isOpen ? "" : " is-leaving"}`}
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-step-title"
    >
      <div className="tour-panel-top">
        <span className="tour-kicker">
          {title} guide · {index + 1} of {visibleSteps.length}
        </span>
        <button type="button" className="icon-action" onClick={close} aria-label="Close the guide">
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <h2 id="tour-step-title" ref={headingRef} tabIndex={-1}>{shown.title}</h2>
      <p>{shown.text}</p>
      <div className="tour-panel-foot">
        <div className="tour-dots" aria-hidden="true">
          {visibleSteps.map((s, i) => (
            <span key={s.title} className={i === index ? "is-current" : i < index ? "is-done" : ""} />
          ))}
        </div>
        <div className="tour-nav">
          {index > 0 && (
            <button type="button" className="secondary-button small" onClick={() => go(-1)}>
              <ArrowLeft size={16} aria-hidden="true" /> Back
            </button>
          )}
          {isLast ? (
            <button type="button" className="primary-button small" onClick={close}>Done</button>
          ) : (
            <button type="button" className="primary-button small" onClick={() => go(1)}>
              Next <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
