import { useEffect, useRef, useState } from "react";

// True once the page has scrolled past its sentinel (a marker at the very top). The header uses it
// to turn from transparent to a frosted bar only while content slides under it.
export default function useStuck() {
  const sentinel = useRef(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [sentinel, stuck];
}
