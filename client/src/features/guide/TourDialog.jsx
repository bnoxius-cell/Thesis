import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";
import Logo from "@/assets/logo.png";
import { Button, Chip, IconButton, Modal } from "@/shared/ui";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import { scrollToId } from "@/shared/hooks/useHashScroll";
import Spotlight from "./Spotlight";
import StepDots from "./StepDots";
import { CARD_ABOVE_BAR, cardOffset, holeFor } from "./spotlightLayout";
import useSpotlight from "./useSpotlight";
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

// The welcome tour window (Figma 315:48 to 315:402, 322:957, 322:1126, phone 316:312, 316:390). Every
// step sits in the same grid cell, so the window keeps one height from the first step to the last and
// only the current one shows. A step that points at menu items dims the page around them (Spotlight)
// and moves the window next to the hole; step 1, or a step whose items aren't on screen, is a plain
// centred window over the normal dim. Back, Next and the left and right arrow keys move between steps; every other
// way out (Skip, the X, Escape, dragging the sheet down, the last button) goes through `onClose`.
export default function TourDialog({ onClose }) {
  const [index, setIndex] = useState(0);
  const phone = useMediaQuery("(max-width: 1023px)"); // where the bottom bar replaces the left menu
  const { pathname } = useLocation();
  const primaryRef = useRef(null);
  const stepsRef = useRef(null);
  const last = index === LAST;
  const { targets } = TOUR_STEPS[index];
  const measure = useSpotlight(targets);
  const hole = useMemo(() => (measure ? holeFor(measure, phone) : null), [measure, phone]);

  // The window rests centred (a bottom sheet on a phone); its offset is a CSS translate, so it slides
  // between steps without fighting the dialog's own entrance animation.
  useLayoutEffect(() => {
    const card = stepsRef.current?.closest(".welcome-tour");
    if (!card) return;
    // Above the bar a card that is too tall for the room scrolls its text instead of covering the hole.
    card.style.maxHeight = hole && phone ? `${measure.frameTop - 2 * CARD_ABOVE_BAR}px` : "";
    const { dx, dy } = hole ? cardOffset(card, measure, hole, phone) : { dx: 0, dy: 0 };
    card.style.translate = hole ? `${dx}px ${dy}px` : "";
  }, [hole, measure, phone]);

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
      overlayClassName={hole ? "welcome-tour-overlay--spot" : ""}
      data-spot={hole ? "true" : undefined}
      labelledBy={`tour-title-${TOUR_STEPS[index].key}`}
      initialFocusRef={primaryRef}
      onClose={onClose}
      actions={(
        <>
          <div className="welcome-tour__buttons">
            {!last && <Button variant="ghost" className="welcome-tour__skip" onClick={onClose}>Skip tour</Button>}
            {index > 0 && <Button variant="ghost" onClick={() => go(-1)}>Back</Button>}
            <Button ref={primaryRef} onClick={last ? finish : () => go(1)}>{last ? "Let's get started" : "Next"}</Button>
          </div>
          <p className="welcome-tour__note" aria-hidden={!last} data-shown={last}>You can take this tour again from Settings &gt; Help.</p>
        </>
      )}
    >
      <IconButton plain label="Close" icon={X} className="welcome-tour__close" onClick={onClose} />
      <div ref={stepsRef} className="welcome-tour__steps">
        {TOUR_STEPS.map((step, i) => (
          <TourStep key={step.key} step={step} position={positionOf(i, index)} phone={phone} />
        ))}
      </div>
      <StepDots count={TOUR_STEPS.length} current={index + 1} />
      <p className="sr-only" role="status">Step {index + 1} of {TOUR_STEPS.length}</p>
      {hole && <Spotlight hole={hole} />}
    </Modal>
  );
}
