import { useCallback, useState } from "react";

// One observer for every element that asks, so a long list of photos doesn't create one each.
const callbacks = new Map();
let observer = null;

function watch(element, onSeen) {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        callbacks.get(entry.target)?.();
        unwatch(entry.target);
      }
    },
    { rootMargin: "200px" }, // starts a little before it scrolls into view
  );
  callbacks.set(element, onSeen);
  observer.observe(element);
}

function unwatch(element) {
  callbacks.delete(element);
  observer?.unobserve(element);
}

// [ref, seen]: put `ref` on an element and `seen` turns true, for good, once it has come near the
// screen. Without IntersectionObserver it is true at once.
export default function useSeenOnce() {
  const [seen, setSeen] = useState(false);
  const ref = useCallback((element) => {
    if (!element) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return undefined;
    }
    watch(element, () => setSeen(true));
    return () => unwatch(element);
  }, []);
  return [ref, seen];
}
