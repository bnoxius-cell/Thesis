import "./week-bars.css";

const BAR_MIN = 0.12;

const hours = (n) => `${Math.round(n * 10) / 10}h`;

// Seven bars, one per day from today: classes plus study work, tallest day flagged. Today's label is
// stressed and the heaviest day takes the watch tone, never red. Bars draw in once on arrival.
// `days` is the week from buildWeek; `heaviestKey` is the day to flag, or null. `size="lg"` is the
// Wellbeing chart (taller bars, today as a pill); `legend` adds the Heaviest day and Today key under it.
// With `onOpenDay(dayKey)` every column is a button that opens that day's window.
export default function WeekBars({ days, heaviestKey = null, size = "md", legend = false, onOpenDay }) {
  const totals = days.map((d) => d.busyHours + d.load);
  const tallest = Math.max(...totals, 1);
  const summary = days
    .map((d, i) => `${d.label} ${hours(totals[i])}${d.key === heaviestKey ? " (heaviest)" : ""}`)
    .join(", ");

  return (
    <>
      <div
        className={`workload-bars${size === "lg" ? " workload-bars--lg" : ""}`}
        role={onOpenDay ? "group" : "img"}
        aria-label={`Hours on each of the next seven days: ${summary}`}
      >
        {days.map((day, i) => {
          const Col = onOpenDay ? "button" : "div";
          return (
          <Col
            key={day.key}
            className="workload-bars__col"
            style={{ "--i": Math.min(i, 5) }}
            {...(onOpenDay && {
              type: "button",
              "aria-haspopup": "dialog",
              "aria-label": `Open ${day.label}, ${hours(totals[i])}${day.key === heaviestKey ? ", heaviest" : ""}`,
              onClick: () => onOpenDay(day.key),
            })}
          >
            <span className="workload-bars__track">
              <span
                className={`workload-bars__bar${i === 0 ? " is-today" : ""}${day.key === heaviestKey ? " is-heaviest" : ""}`}
                style={{ "--level": Math.max(totals[i] / tallest, BAR_MIN) }}
              />
            </span>
            <span className={`workload-bars__label${i === 0 ? " is-today" : ""}`}>{day.label}</span>
          </Col>
          );
        })}
      </div>
      {legend && (
        <ul className="workload-bars__legend" aria-hidden="true">
          <li><span className="workload-bars__key is-heaviest" />Heaviest</li>
          <li><span className="workload-bars__key is-today" />Today</li>
        </ul>
      )}
    </>
  );
}
