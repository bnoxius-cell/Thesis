import { useCallback, useEffect, useState } from "react";

// How long a day or row a link landed on stays marked (the `is-found` look in item-detail.css).
export const FOUND_MS = 2400;

// One thing at a time that is marked for a moment. `flash(id)` marks `id` and unmarks it after FOUND_MS;
// `flashed` is the marked id or null. A second call restarts the timer. The timer belongs to an effect
// that depends on the mark, so it is started again when React re-runs effects (dev StrictMode).
export default function useFlash() {
  const [mark, setMark] = useState(null);
  const flash = useCallback((id) => setMark({ id }), []);

  useEffect(() => {
    if (!mark) return undefined;
    const timer = setTimeout(() => setMark(null), FOUND_MS);
    return () => clearTimeout(timer);
  }, [mark]);

  return [mark?.id ?? null, flash];
}
