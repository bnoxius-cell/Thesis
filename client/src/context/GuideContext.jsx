import { useCallback, useMemo, useRef, useState } from "react";
import { GuideState } from "./guideState";

// The page Guide (components/PageTour.jsx) used to be a floating button. Now the button lives in the
// header (sidebar footer on laptops, top bar on phones), so the header has to know whether the current
// page has a Guide and whether it is open. A page's PageTour registers here on mount and unregisters on
// unmount; the header reads it and asks it to open or close.

export function GuideProvider({ children }) {
  const [tour, setTour] = useState(null); // { page, title } of the page that has a Guide, or null
  const [isOpen, setIsOpen] = useState(false);
  const starterRef = useRef(null); // PageTour's own start(): picks the steps that are on screen
  const tokenRef = useRef(0);

  // Returns the cleanup. A token keeps a late cleanup (one page's Guide leaving after the next page's
  // Guide already arrived, as happens when a page swaps between two renders of itself) from wiping the new one.
  const register = useCallback((next, start) => {
    const token = ++tokenRef.current;
    starterRef.current = start;
    setTour(next);
    return () => {
      if (tokenRef.current !== token) return;
      starterRef.current = null;
      setTour(null);
      setIsOpen(false);
    };
  }, []);

  const close = useCallback(() => setIsOpen(false), []);
  // Opening goes through the page's own start(), which skips steps whose section isn't on screen.
  const toggle = useCallback(() => {
    if (isOpen) setIsOpen(false);
    else starterRef.current?.({ auto: false });
  }, [isOpen]);

  const value = useMemo(
    () => ({ tour, isOpen, setIsOpen, register, close, toggle }),
    [tour, isOpen, register, close, toggle],
  );

  return <GuideState.Provider value={value}>{children}</GuideState.Provider>;
}
