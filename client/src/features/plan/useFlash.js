import { useCallback, useEffect, useRef, useState } from "react";

// How long a day or row a link landed on stays marked (the `is-found` look in item-detail.css).
export const FOUND_MS = 2400;

// One thing at a time that is marked for a moment. `flash(id)` marks `id` and unmarks it after FOUND_MS;
// `flashed` is the marked id or null. A second call restarts the timer.
export default function useFlash() {
  const [flashed, setFlashed] = useState(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const flash = useCallback((id) => {
    clearTimeout(timer.current);
    setFlashed(id);
    timer.current = setTimeout(() => setFlashed(null), FOUND_MS);
  }, []);

  return [flashed, flash];
}
