import { useCallback, useSyncExternalStore } from "react";

// True while a CSS media query matches, and re-renders when it starts or stops matching. Use it when
// the two layouts are different markup (a week grid or a day strip), not just different styling.
export default function useMediaQuery(query) {
  const subscribe = useCallback((notify) => {
    const list = window.matchMedia(query);
    list.addEventListener("change", notify);
    return () => list.removeEventListener("change", notify);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
