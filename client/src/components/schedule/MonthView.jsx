import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, monthOfWeek, monthWeeks, toISODate } from "../../utils/scheduleUtils";
import WeekView from "./WeekView";
import { prefersLessMotion } from "../../utils/motion";

const monthLabel = (d) => d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
const sameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

// A month as a stack of week cards: one bar at the very top (previous, the month, next, and
// "This week"), then a WeekView per week. A week belongs to the month its Thursday is in, so
// every week shows once and a month has 4 or 5 cards. The page scrolls; the arrows live only here.
//
// `month` is the first of the month on show; `onMonthChange` takes the first of another month.
// All the other props go straight to each week card.
export default function MonthView({ month, onMonthChange, ...weekProps }) {
  const rootRef = useRef(null);
  const pendingScroll = useRef(false);
  const [direction, setDirection] = useState("none");
  // Whether the current week's card is on screen (its middle band touches the viewport's), so
  // "This week" can say there is nothing to do.
  const [currentOnScreen, setCurrentOnScreen] = useState(false);

  const today = new Date();
  const todayMonday = toISODate(addDays(today, -((today.getDay() + 6) % 7)));
  const currentMonth = monthOfWeek(today);
  const monthKey = toISODate(month);
  const weeks = monthWeeks(month);
  const currentShown = sameMonth(month, currentMonth);

  const moveTo = (target, dir) => {
    setDirection(dir);
    onMonthChange(target);
  };
  const shiftMonth = (n) => moveTo(new Date(month.getFullYear(), month.getMonth() + n, 1), n > 0 ? "next" : "prev");

  const scrollToCurrent = () => {
    const card = rootRef.current?.querySelector("[data-current-week]");
    if (!card) return false;
    card.scrollIntoView({ block: "start", behavior: prefersLessMotion() ? "auto" : "smooth" });
    return true;
  };
  const goToThisWeek = () => {
    if (currentShown) {
      scrollToCurrent();
      return;
    }
    // Another month is on show: switch first, scroll once the new cards have rendered.
    pendingScroll.current = true;
    moveTo(currentMonth, currentMonth > month ? "next" : "prev");
  };

  useEffect(() => {
    if (!pendingScroll.current) return;
    pendingScroll.current = false;
    scrollToCurrent();
  }, [monthKey]);

  useEffect(() => {
    const card = rootRef.current?.querySelector("[data-current-week]");
    if (!card || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setCurrentOnScreen(entry.isIntersecting),
      { rootMargin: "-25% 0px -25% 0px" },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [monthKey]);

  // aria-disabled instead of disabled: the button keeps focus after it scrolls the card into view.
  const thisWeekDone = currentShown && currentOnScreen;

  return (
    <div className="sched-month" ref={rootRef} data-tour="sched-week">
      <div className="sched-month-bar">
        <button type="button" className="icon-action" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h2 aria-live="polite">{monthLabel(month)}</h2>
        <button type="button" className="icon-action" onClick={() => shiftMonth(1)} aria-label="Next month">
          <ChevronRight size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="secondary-button small sched-this-week"
          onClick={() => { if (!thisWeekDone) goToThisWeek(); }}
          aria-disabled={thisWeekDone || undefined}
        >
          This week
        </button>
      </div>

      <div className="sched-month-weeks" key={monthKey} data-dir={direction}>
        {weeks.map((monday, i) => (
          <WeekView
            key={toISODate(monday)}
            {...weekProps}
            weekStart={monday}
            showNav={false}
            title={`Week ${i + 1}`}
            monthIndex={month.getMonth()}
            isCurrent={toISODate(monday) === todayMonday}
          />
        ))}
      </div>
    </div>
  );
}
