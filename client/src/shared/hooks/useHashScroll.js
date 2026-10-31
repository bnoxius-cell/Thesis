import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { prefersLessMotion } from "@/utils/motion";

const behavior = () => (prefersLessMotion() ? "auto" : "smooth");

// Scrolls to the element a #hash names. Content that loads in later passes `ready` as false until it is
// there, so a link like /wellbeing#sleep still lands once the page has drawn. Leaving a hash for the
// bare path (the sidebar's Overview) goes back to the top. Respects reduced motion.
export default function useHashScroll(ready = true) {
  const { hash } = useLocation();
  const seen = useRef(hash);

  useEffect(() => {
    if (!ready) return;
    const hadHash = Boolean(seen.current);
    seen.current = hash;
    if (hash) {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ behavior: behavior(), block: "start" });
    } else if (hadHash) {
      window.scrollTo({ top: 0, behavior: behavior() });
    }
  }, [hash, ready]);
}

// Smooth scroll to an element by id, for a button that points at a section on the same page.
export function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: behavior(), block: "start" });
}
