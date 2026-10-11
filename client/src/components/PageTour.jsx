import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CircleHelp, X } from "lucide-react";
import { useAuth } from "../pages/authentication/AuthContext";

// The "Guide" button in the bottom-right corner of the main pages. It opens a short, step by step
// walkthrough of the page. A step's `target` names a `data-tour` attribute on the page: the guide
// scrolls to it and outlines it. Steps whose target isn't on screen (a section that only shows once
// there's data, or the other view of the page) are left out, so the guide matches what the student
// sees. Nothing opens on its own; a small dot on the button says the guide hasn't been opened yet,
// remembered per account in this browser (like the check-in snooze).

const HIGHLIGHT = "tour-target";
const seenKey = (userId, page) => `stresscare:tour-seen:${userId || "guest"}:${page}`;

function readSeen(key) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return true; // storage blocked: skip a dot that could never go away
  }
}

function findTarget(target) {
  return target ? document.querySelector(`[data-tour="${target}"]`) : null;
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
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
  const key = seenKey(user?._id, page);
  const [seen, setSeen] = useState(() => readSeen(key));
  const [open, setOpen] = useState(false);
  const [visibleSteps, setVisibleSteps] = useState([]);
  const [index, setIndex] = useState(0);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const headingRef = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus({ preventScroll: true });
  }, []);

  const start = () => {
    const available = steps.filter((step) => !step.target || findTarget(step.target));
    if (!available.length) return;
    setVisibleSteps(available);
    setIndex(0);
    setOpen(true);
    if (!seen) {
      setSeen(true);
      try {
        localStorage.setItem(key, "1");
      } catch {
        // Private mode or blocked storage: the dot comes back next time, nothing else breaks.
      }
    }
  };

  const step = open ? visibleSteps[index] : null;
  const isLast = index === visibleSteps.length - 1;

  // Outline the current step's section and bring it into view. Looked up again on every step,
  // so a section that went away while the guide was open just isn't outlined.
  useEffect(() => {
    if (!step) return undefined;
    headingRef.current?.focus({ preventScroll: true });
    const el = findTarget(step.target);
    if (!el) return undefined;
    el.classList.add(HIGHLIGHT);
    scrollToTarget(el, panelRef.current);
    return () => el.classList.remove(HIGHLIGHT);
  }, [step]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      // A dialog opened on top of the guide handles its own keys.
      if (document.querySelector(".modal-overlay")) return;
      if (e.key === "Escape") {
        close();
        return;
      }
      // Arrows only while the guide has focus, so they never fight the page's own controls.
      if (!panelRef.current?.contains(e.target)) return;
      if (e.key === "ArrowRight" && !isLast) setIndex((i) => i + 1);
      if (e.key === "ArrowLeft" && index > 0) setIndex((i) => i - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close, isLast, index]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`tour-button${open ? " is-open" : ""}`}
        onClick={open ? close : start}
        aria-expanded={open}
        aria-label={open ? "Close the guide" : `Guide: how the ${title} page works`}
        title={open ? "Close the guide" : "How this page works"}
      >
        {open ? <X size={20} aria-hidden="true" /> : <CircleHelp size={20} aria-hidden="true" />}
        <span className="tour-button-label">Guide</span>
        {!seen && <span className="tour-button-dot" aria-hidden="true" />}
      </button>

      {step && (
        <section ref={panelRef} className="tour-panel" role="dialog" aria-modal="false" aria-labelledby="tour-step-title">
          <div className="tour-panel-top">
            <span className="tour-kicker">
              {title} guide · {index + 1} of {visibleSteps.length}
            </span>
            <button type="button" className="tour-close" onClick={close} aria-label="Close the guide">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <h2 id="tour-step-title" ref={headingRef} tabIndex={-1}>{step.title}</h2>
          <p>{step.text}</p>
          <div className="tour-panel-foot">
            <div className="tour-dots" aria-hidden="true">
              {visibleSteps.map((s, i) => (
                <span key={s.title} className={i === index ? "is-current" : i < index ? "is-done" : ""} />
              ))}
            </div>
            <div className="tour-nav">
              {index > 0 && (
                <button type="button" className="secondary-button small" onClick={() => setIndex((i) => i - 1)}>
                  <ArrowLeft size={16} aria-hidden="true" /> Back
                </button>
              )}
              {isLast ? (
                <button type="button" className="primary-button small" onClick={close}>Done</button>
              ) : (
                <button type="button" className="primary-button small" onClick={() => setIndex((i) => i + 1)}>
                  Next <ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
