import "./month.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_LABELS = 2;

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// "Mon, Oct 6: 2 classes, Lab 1 due". Said by a screen reader instead of the dots and labels.
function spoken(day) {
  const date = day.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const parts = [day.classCount > 0 && plural(day.classCount, "class"), ...day.labels.map((label) => label.text)];
  return `${date}${day.isToday ? ", today" : ""}${parts.some(Boolean) ? `: ${parts.filter(Boolean).join(", ")}` : ""}`;
}

function DayCell({ day, onOpen }) {
  const shown = day.labels.slice(0, MAX_LABELS);
  const hidden = day.labels.length - shown.length;
  const hasDue = day.labels.length > 0;
  return (
    <button
      type="button"
      className={`plan-day${day.isToday ? " is-today" : ""}${day.inMonth ? "" : " is-outside"}`}
      aria-label={`${spoken(day)}. Open this week`}
      aria-current={day.isToday ? "date" : undefined}
      onClick={() => onOpen(day.date)}
    >
      <span className="plan-day__num" aria-hidden="true">{day.dayNumber}</span>
      {day.dots.length > 0 && (
        <span className="plan-day__dots" aria-hidden="true">
          {day.dots.map((tone, i) => <span key={i} className={`plan-day__dot plan-day__dot--${tone}`} />)}
        </span>
      )}
      {hasDue && <span className="plan-day__flag" aria-hidden="true" />}
      <span className="plan-day__labels" aria-hidden="true">
        {shown.map((label) => (
          <span key={label.id} className={`plan-day__label plan-day__label--${label.tone}`}>{label.text}</span>
        ))}
        {hidden > 0 && <span className="plan-day__more">+{hidden} more</span>}
      </span>
    </button>
  );
}

// The month as a grid of days, Monday first (Figma 38:234): the date, a dot for each class and a
// short label for each holiday, exam or task due. Phones draw the dots and a small bar instead of
// the labels. Clicking a day opens that week. `direction` is which way the month was stepped, so the
// new one slides in from that side.
export default function MonthGrid({ rows, label, onOpen, direction }) {
  return (
    <div className="plan-month plan-slide" data-direction={direction} role="group" aria-label={label}>
      <div className="plan-month__head" aria-hidden="true">
        {WEEKDAYS.map((name) => <span key={name}>{name}</span>)}
      </div>
      {rows.map((row) => (
        <div key={row[0].key} className="plan-month__row">
          {row.map((day) => <DayCell key={day.key} day={day} onOpen={onOpen} />)}
        </div>
      ))}
    </div>
  );
}
