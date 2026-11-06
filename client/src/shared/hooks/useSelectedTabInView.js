import { useEffect, useRef } from "react";
import { prefersLessMotion } from "@/utils/motion";

// On a narrow phone a tab track scrolls inside itself, so the selected tab is brought into view: at
// once when the page opens on it, with a short scroll when the student picks another one.
// `tabId` is the element id of the selected tab; `ready` is false while the track isn't on screen.
export default function useSelectedTabInView(tabId, ready) {
  const opened = useRef(false);
  useEffect(() => {
    const selected = ready && document.getElementById(tabId);
    if (!selected) return;
    const track = selected.parentElement;
    const reveal = (behavior) => {
      const trackBox = track.getBoundingClientRect();
      const tabBox = selected.getBoundingClientRect();
      const shift = tabBox.left < trackBox.left ? tabBox.left - trackBox.left : Math.max(0, tabBox.right - trackBox.right);
      if (shift) track.scrollBy({ left: shift, behavior });
    };
    reveal(opened.current && !prefersLessMotion() ? "smooth" : "auto");
    opened.current = true;
    // A count arriving later (Reviewers 1) widens a tab and can push the selected one out of view.
    // An observer reports once as soon as it starts; that call would cancel the smooth scroll above.
    let started = false;
    const watcher = new ResizeObserver(() => {
      if (started) reveal("auto");
      started = true;
    });
    Array.from(track.children).forEach((child) => watcher.observe(child));
    return () => watcher.disconnect();
  }, [tabId, ready]);
}
