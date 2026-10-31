import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

// A route change swaps the page under a link that keeps focus (or removes it), so keyboard and
// screen reader users would be left at the old spot. This moves focus to <main> when the path
// changes. Search and hash changes (tabs, week picker) leave focus alone, and so does an open dialog.
// `onMount` also focuses on the first render: right for a screen opened from a link, wrong for a
// page load, where the skip link should be the first stop.
export default function useFocusMain(ref, { onMount = false } = {}) {
  const { pathname } = useLocation();
  const first = useRef(true);

  useEffect(() => {
    const isFirst = first.current;
    first.current = false;
    if (isFirst && !onMount) return;
    if (document.querySelector('[role="dialog"]')) return;
    ref.current?.focus({ preventScroll: true });
  }, [pathname, onMount, ref]);
}
