import { useEffect, useState } from "react";

// Eases a number up from 0 the first time it appears, and between values after that.
// People who ask for reduced motion just get the number.
export default function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const id = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(id);
    }
    let frame;
    let from = null;
    let startedAt = null;
    const tick = (now) => {
      if (startedAt === null) startedAt = now;
      const t = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue((current) => {
        if (from === null) from = current;
        return Math.round(from + (target - from) * eased);
      });
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
