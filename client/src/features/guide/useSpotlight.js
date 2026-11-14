import { useEffect, useState } from "react";
import { measureTargets, sameMeasure } from "./spotlightLayout";

// The measured box around the menu items a tour step points at (see spotlightLayout.js), kept up to date
// as the window is resized or anything scrolls. Null when the step has no targets or none is on
// screen. Measuring waits one frame, so it never works against the layout that is still settling.
export default function useSpotlight(targets) {
  const [measure, setMeasure] = useState(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const next = measureTargets(targets);
      setMeasure((prev) => (sameMeasure(prev, next) ? prev : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // A short sidebar can scroll: bring the items into view first. No-op when they already are.
    targets.forEach((key) => document.querySelector(`[data-tour-target="${key}"]`)?.scrollIntoView({ block: "nearest" }));
    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [targets]);

  return targets.length > 0 ? measure : null;
}
