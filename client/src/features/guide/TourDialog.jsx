import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";
import Logo from "@/assets/logo.png";
import { Button, Chip, IconButton, Modal } from "@/shared/ui";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import { scrollToId } from "@/shared/hooks/useHashScroll";
import StepDots from "./StepDots";
import { TOUR_STEPS, whereToFind } from "./tourSteps";
import "./guide.css";

const LAST = TOUR_STEPS.length - 1;

// Where a step sits relative to the current one: it drives the slide direction in guide.css.
function positionOf(i, current) {
  if (i < current) return "before";
  return i === current ? "current" : "after";
}

function TourStep({ step, position, phone }) {
  const where = whereToFind(step, phone);
  return (
    <div className="tour-step" data-pos={position} aria-hidden={position !== "current"}>
      <span className="tour-step__art" aria-hidden="true">
        {step.icons ? step.icons.map((Icon, i) => <Icon key={i} size={32} strokeWidth={1.75} />) : <img src={Logo} alt="" className="tour-step__logo" />}
      </span>
      <div className="tour-step__copy">
        <h2 id={`tour-title-${step.key}`} className="tour-step__title">{step.title}</h2>
        <p className="tour-step__text">{step.text}</p>
      </div>
      {where && (
        <p className="tour-step__where">
          Where to find it
          <Chip tone="neutral">{where}</Chip>
        </p>
      )}
    </div>
  );
}

// The welcome tour window (Figma 315:48 to 315:402, phone sheet 316:312, 316:390). Every step sits in
// the same grid cell, so the window keeps one height from the first step to the last and only the
// current one shows. Back, Next and the left and right arrow keys move between steps; every other
// way out (Skip, the X, Escape, dragging the sheet down, the last button) goes through `onClose`.
export default function TourDialog({ onClose }) {
  const [index, setIndex] = useState(0);
  const phone = useMediaQuery("(max-width: 1023px)"); // where the bottom bar replaces the left menu
  const { pathname } = useLocation();
  const primaryRef = useRef(null);
  const last = index === LAST;

  // Focus goes to the main button after a move: Back can vanish on step 1, and focus must not fall to the page.
  const go = useCallback((delta) => {
    setIndex((i) => Math.min(LAST, Math.max(0, i + delta)));
    primaryRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [go]);

  const finish = () => {
    onClose();
    if (pathname === "/home") requestAnimationFrame(() => scrollToId("get-started"));
  };

  return (
    <Modal
      sheet
      className="welcome-tour"
      labelledBy={`tour-title-${TOUR_STEPS[index].key}`}
      initialFocusRef={primaryRef}
      onClose={onClose}
      actions={(
        <>
          {!last && <Button variant="ghost" className="welcome-tour__skip" onClick={onClose}>Skip tour</Button>}
          {index > 0 && <Button variant="ghost" onClick={() => go(-1)}>Back</Button>}
          <Button ref={primaryRef} onClick={last ? finish : () => go(1)}>{last ? "Let's get started" : "Next"}</Button>
          <p className="welcome-tour__note" aria-hidden={!last} data-shown={last}>You can take this tour again from Settings &gt; Help.</p>
        </>
      )}
    >
      <IconButton plain label="Close" icon={X} className="welcome-tour__close" onClick={onClose} />
      <div className="welcome-tour__steps">
        {TOUR_STEPS.map((step, i) => (
          <TourStep key={step.key} step={step} position={positionOf(i, index)} phone={phone} />
        ))}
      </div>
      <StepDots count={TOUR_STEPS.length} current={index + 1} />
      <p className="sr-only" role="status">Step {index + 1} of {TOUR_STEPS.length}</p>
    </Modal>
  );
}
