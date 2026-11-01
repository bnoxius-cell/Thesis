import { useLayoutEffect, useRef, useState } from "react";

const WIDE_AT = 760; // px of content width (the sidebar already took its 240px) where two columns fit
const STRIP_HEIGHT = 250;

// Rough heights, only used to decide which column gets the 7-day strip so the two end near each other.
const estimate = ({ todayRows, comingRows, nextHeight, hasCheckIn }) => ({
  left: 160 + todayRows * 64 + (comingRows > 0 ? 90 + comingRows * 66 : 0),
  right: 340 + nextHeight + (hasCheckIn ? 80 : 0),
});

// Is the wrapper wide enough for two columns? Measured before the first paint, then on resize.
function useIsWide(ref) {
  const [wide, setWide] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setWide(el.getBoundingClientRect().width >= WIDE_AT);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return wide;
}

// The DOM order is the phone order (quick add, week card, Today, Coming up, Next step, the 7-day strip), so Tab and screen readers follow what a phone shows. On a wide screen the cards are
// regrouped into two columns: quick add, Today and Coming up on the left, the week card and Next step on the right,
// with the strip under whichever column is shorter.
export default function TodayLayout({ week, quick, today, coming, next, strip, sizes }) {
  const ref = useRef(null);
  const wide = useIsWide(ref);

  let body;
  if (wide) {
    const { left, right } = estimate(sizes);
    const stripLeft = Math.abs(left + STRIP_HEIGHT - right) < Math.abs(left - (right + STRIP_HEIGHT));
    body = (
      <div className="today-layout is-wide">
        <div className="today-col">{quick}{today}{coming}{stripLeft && strip}</div>
        <div className="today-col">{week}{next}{!stripLeft && strip}</div>
      </div>
    );
  } else {
    body = <div className="today-layout">{quick}{week}{today}{coming}{next}{strip}</div>;
  }

  return <div className="today-wrap" ref={ref}>{body}</div>;
}
