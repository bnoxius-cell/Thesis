import "./week-bars.css";

const BAR_MIN = 0.12;

const hours = (n) => `${Math.round(n * 10) / 10}h`;

// Seven bars, one per day from today: classes plus study work, tallest day flagged. Today's label is
// stressed and the heaviest day takes the watch tone, never red. Bars draw in once on arrival.
// `days` is the week from buildWeek; `heaviestKey` is the day to flag, or null.
export default function WeekBars({ days, heaviestKey = null }) {
  const totals = days.map((d) => d.busyHours + d.load);
  const tallest = Math.max(...totals, 1);
  const summary = days
    .map((d, i) => `${d.label} ${hours(totals[i])}${d.key === heaviestKey ? " (heaviest)" : ""}`)
    .join(", ");

  return (
    <div className="workload-bars" role="img" aria-label={`Hours on each of the next seven days: ${summary}`}>
      {days.map((day, i) => (
        <div key={day.key} className="workload-bars__col" style={{ "--i": Math.min(i, 5) }}>
          <span className="workload-bars__track">
            <span
              className={`workload-bars__bar${day.key === heaviestKey ? " is-heaviest" : ""}`}
              style={{ "--level": Math.max(totals[i] / tallest, BAR_MIN) }}
            />
          </span>
          <span className={`workload-bars__label${i === 0 ? " is-today" : ""}`}>{day.label}</span>
        </div>
      ))}
    </div>
  );
}
