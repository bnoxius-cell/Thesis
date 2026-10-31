import { useEffect, useState } from "react";

// The current time, refreshed every `intervalMs`, so a screen can move on as classes start and finish.
export default function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
