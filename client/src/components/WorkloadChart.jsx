const round1 = (n) => Math.round(n * 10) / 10;

// One column per day. The bottom block is what classes and activities already take,
// the block on top is study time from tasks, and the tick marks how much study time the
// day has room for. A day only turns clay when its tasks don't fit.
export default function WorkloadChart({ schedule, hasSchedule = false }) {
  const scale = Math.max(...schedule.map((d) => d.busyHours + Math.max(d.load, d.capacity)), 1);
  const pct = (hours) => (hours / scale) * 100;

  return (
    <div className="chart-shell">
      <div className="chart-grid" role="list">
        {schedule.map((day) => {
          const overloaded = day.load > day.capacity + 0.05;
          const total = round1(day.busyHours + day.load);
          const summary = `${day.label} ${day.dateLabel}: ${day.busyHours}h of classes and activities, ${day.load}h of tasks, room for ${day.capacity}h of study${day.holiday ? `, ${day.holiday}` : ""}`;

          return (
            <div className={`chart-column ${day.holiday ? "is-holiday" : ""}`} key={day.key} role="listitem" aria-label={summary} title={summary}>
              <span className="chart-value">{total}h</span>
              <div className="chart-bar-track">
                <div className="chart-stack">
                  {day.load > 0 && (
                    <div className={`chart-bar ${overloaded ? "overloaded" : ""}`} style={{ height: `${pct(day.load)}%` }} />
                  )}
                  {day.busyHours > 0 && (
                    <div className="chart-bar chart-busy" style={{ height: `${pct(day.busyHours)}%` }} />
                  )}
                  <span className="chart-capacity" style={{ bottom: `${pct(day.busyHours + day.capacity)}%` }} aria-hidden="true" />
                </div>
              </div>
              <strong>{day.label}</strong>
              <span className="chart-date">{day.holiday ? "Holiday" : day.dateLabel}</span>
            </div>
          );
        })}
      </div>

      <div className="chart-legend">
        {hasSchedule && <span><i className="legend-swatch busy" /> Classes and activities</span>}
        <span><i className="legend-swatch" /> Tasks</span>
        <span><i className="legend-swatch overload" /> Tasks that don't fit</span>
        <span><i className="legend-tick" /> Room for study</span>
      </div>
    </div>
  );
}
