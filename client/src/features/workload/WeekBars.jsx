import "./week-bars.css";

const BAR_MIN = 0.12;
// Prep below this many hours rounds to nothing, so it gets no outline.
const PREP_MIN = 0.1;

const round1 = (n) => Math.round(n * 10) / 10;
const hours = (n) => `${round1(n)} h`;

// What a column says, on its hover label and in its name (Figma 348:4956). Today counts the hours still
// open tonight; a day with prep names it in brackets; a day with only due work says "due".
function dayText(day, isToday) {
  const total = day.busyHours + day.load;
  if (isToday) return `${day.label} · ${hours(day.capacity)} left`;
  if (day.prep >= PREP_MIN) return `${day.label} · ${hours(total)} (${hours(day.prep)} prep)`;
  if (day.due > 0 && day.busyHours === 0) return `${day.label} · ${hours(day.due)} due`;
  return `${day.label} · ${hours(total)}`;
}

// Seven bars, one per day from today. The solid bar is classes plus work due that day; prep for a later
// deadline is a dotted outline that rises from the same baseline and wraps the bar. Today's label is
// stressed and the heaviest day takes a navy tone, never red. Bars draw in once on arrival.
// `days` is the week from buildWeek; `heaviestKey` is the day to flag, or null. `size="lg"` is the
// Wellbeing chart (taller bars, today as a pill); `legend` adds the Today, Heaviest and Prep key under it.
// With `onOpenDay(dayKey)` every column is a button that opens that day's window and shows a desktop hover tip.
export default function WeekBars({ days, heaviestKey = null, size = "md", legend = false, onOpenDay }) {
  const tallest = Math.max(...days.map((d) => d.busyHours + d.load), 1);
  // Names read the same words as the hover label, with a comma where the label has a dot.
  const names = days.map((d, i) => `${dayText(d, i === 0).replace(" · ", ", ")}${d.key === heaviestKey ? ", heaviest" : ""}`);

  return (
    <>
      <div
        className={`workload-bars${size === "lg" ? " workload-bars--lg" : ""}`}
        role={onOpenDay ? "group" : "img"}
        aria-label={`Hours on each of the next seven days: ${names.join("; ")}`}
      >
        {days.map((day, i) => {
          const Col = onOpenDay ? "button" : "div";
          const solid = Math.max((day.busyHours + day.due) / tallest, BAR_MIN);
          const withPrep = Math.max((day.busyHours + day.load) / tallest, solid);
          return (
          <Col
            key={day.key}
            className="workload-bars__col"
            style={{ "--i": Math.min(i, 5) }}
            {...(onOpenDay && {
              type: "button",
              "aria-haspopup": "dialog",
              "aria-label": `Open ${names[i]}`,
              onClick: () => onOpenDay(day.key),
            })}
          >
            {onOpenDay && <span className="workload-bars__tip" aria-hidden="true">{dayText(day, i === 0)}</span>}
            <span className="workload-bars__track">
              <span
                className={`workload-bars__bar${i === 0 ? " is-today" : ""}${day.key === heaviestKey ? " is-heaviest" : ""}${day.prep >= PREP_MIN ? " has-prep" : ""}`}
                style={{ "--level": solid, "--prep-level": withPrep }}
              />
            </span>
            <span className={`workload-bars__label${i === 0 ? " is-today" : ""}`}>{day.label}</span>
          </Col>
          );
        })}
      </div>
      {legend && (
        <ul className="workload-bars__legend" aria-hidden="true">
          <li><span className="workload-bars__key is-today" />Today</li>
          <li><span className="workload-bars__key is-heaviest" />Heaviest</li>
          <li><span className="workload-bars__key is-prep" />{size === "lg" ? "Prep for a later deadline" : "Prep"}</li>
        </ul>
      )}
    </>
  );
}
