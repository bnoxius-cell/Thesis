import { useCallback, useLayoutEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const HIDDEN = { y: 0, height: 0, visible: false };

// Where the sidebar's lit pill sits: the box of the link marked aria-current inside `ref`, measured
// from the top of that container (both boxes scroll together, so the difference is already right). It moves with the route and when the sidebar changes size (font
// load, a badge appearing, a short window). `ready` turns true after the first measurement, so the
// pill appears in place on load and only slides on later moves.
export default function useNavPill(ref) {
  const { pathname, search, hash } = useLocation();
  const [pill, setPill] = useState(HIDDEN);
  const [ready, setReady] = useState(false);

  const measure = useCallback(() => {
    const box = ref.current;
    const lit = box?.querySelector('[aria-current="page"]');
    if (!lit) {
      setPill((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }
    const y = lit.getBoundingClientRect().top - box.getBoundingClientRect().top;
    setPill((prev) =>
      prev.visible && prev.y === y && prev.height === lit.offsetHeight
        ? prev
        : { y, height: lit.offsetHeight, visible: true },
    );
  }, [ref]);

  useLayoutEffect(() => {
    measure();
  }, [measure, pathname, search, hash]);

  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    // Let the first paint happen with the pill already placed, then allow it to slide.
    const frame = requestAnimationFrame(() => setReady(true));
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [ref, measure]);

  return { ...pill, ready };
}
