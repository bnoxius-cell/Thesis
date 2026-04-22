export default function WorkloadChart({ schedule }) {
  const maxLoad = Math.max(...schedule.map((day) => day.load), 1);

  return (
    <div className="chart-shell">
      <div className="chart-grid">
        {schedule.map((day) => {
          const height = Math.max((day.load / maxLoad) * 100, day.load > 0 ? 12 : 4);
          const overloaded = day.load > day.capacity;

          return (
            <div className="chart-column" key={day.key}>
              <span className="chart-value">{day.load}h</span>
              <div className="chart-bar-track">
                <div
                  className={`chart-bar ${overloaded ? "overloaded" : ""}`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <strong>{day.label}</strong>
              <span className="chart-date">{day.dateLabel}</span>
            </div>
          );
        })}
      </div>

      <div className="chart-legend">
        <span><i className="legend-swatch" /> Healthy load</span>
        <span><i className="legend-swatch overload" /> Over capacity</span>
      </div>
    </div>
  );
}
