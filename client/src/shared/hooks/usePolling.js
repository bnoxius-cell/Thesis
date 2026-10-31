import { useEffect, useRef } from "react";

// Calls `task` now and then every `intervalMs`, but only while the tab is in front. When the tab is
// hidden the timer stops, and when it comes back `task` runs at once and the timer restarts. It
// stops for good on unmount. `task` can change between renders without restarting the timer.
export default function usePolling(task, intervalMs, { enabled = true } = {}) {
  const latest = useRef(task);
  useEffect(() => {
    latest.current = task;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    let timer = null;
    const run = () => latest.current();
    const start = () => {
      run();
      timer = setInterval(run, intervalMs);
    };
    const stop = () => {
      clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      stop();
      if (document.visibilityState === "visible") start();
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [intervalMs, enabled]);
}
