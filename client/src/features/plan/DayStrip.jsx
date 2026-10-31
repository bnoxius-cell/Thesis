import { selectOnArrowKey } from "@/shared/ui/rovingKeys";
import LoadDot from "./LoadDot";

const spoken = (day) =>
  `${day.label}${day.isToday ? ", today" : ""}, ${day.load === "heavy" ? "heavy" : "light"} day`;

// Monday to Sunday as seven tappable days (Figma 40:387), each with its date and load dot. The
// chosen day sits on a pill that slides to it. A tab list: arrows, Home and End move between days,
// and the agenda below is the panel.
export default function DayStrip({ days, selectedKey, onSelect }) {
  const index = days.findIndex((day) => day.key === selectedKey);
  return (
    <div
      role="tablist"
      aria-label="Day of the week"
      className="plan-strip"
      style={{ "--index": index }}
      onKeyDown={(e) => selectOnArrowKey(e, '[role="tab"]')}
    >
      <span className="plan-strip__thumb" aria-hidden="true" />
      {days.map((day, i) => (
        <button
          key={day.key}
          type="button"
          role="tab"
          id={`plan-tab-${day.key}`}
          aria-selected={i === index}
          aria-controls="plan-agenda"
          aria-label={spoken(day)}
          tabIndex={i === index ? 0 : -1}
          className={`plan-strip__day${day.isToday ? " is-today" : ""}`}
          onClick={() => onSelect(day.key)}
        >
          <span className="plan-strip__letter" aria-hidden="true">{day.weekday[0]}</span>
          <span className="plan-strip__num" aria-hidden="true">{day.dayNumber}</span>
          <LoadDot load={day.load} />
        </button>
      ))}
    </div>
  );
}
