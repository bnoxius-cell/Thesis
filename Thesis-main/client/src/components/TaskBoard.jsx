function formatDays(daysLeft) {
  if (daysLeft < 0) return `${Math.abs(daysLeft)} day(s) overdue`;
  if (daysLeft === 0) return "Due today";
  if (daysLeft === 1) return "Due tomorrow";
  return `${daysLeft} days left`;
}

export default function TaskBoard({ tasks, schedule, onDeleteTask }) {
  return (
    <div className="task-board">
      <div className="task-list">
        {tasks.map((task) => (
          <article className="task-card" key={task.id}>
            <div className="task-card-top">
              <div>
                <span className={`status-pill ${task.status.toLowerCase().replace(/\s+/g, "-")}`}>
                  {task.status}
                </span>
                <h3>{task.title}</h3>
                <p>{task.course}</p>
              </div>

              <button className="ghost-button" type="button" onClick={() => onDeleteTask(task.id)}>
                Remove
              </button>
            </div>

            <div className="task-meta">
              <span>{formatDays(task.daysLeft)}</span>
              <span>{task.hours} hrs est.</span>
              <span>{task.workload.toFixed(1)} score</span>
            </div>

            <div className="task-progress">
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.min(task.workload, 100)}%` }}
                />
              </div>
            </div>
          </article>
        ))}
      </div>

      <aside className="schedule-panel">
        <h3>7-Day Study Plan</h3>
        <div className="schedule-stack">
          {schedule.map((day) => (
            <article className="schedule-day" key={day.key}>
              <div className="schedule-day-head">
                <strong>{day.label}</strong>
                <span>{day.load}h planned</span>
              </div>

              <p className="schedule-date-label">{day.dateLabel}</p>

              <div className="schedule-items">
                {day.items.length ? (
                  day.items.map((item, index) => (
                    <div className="schedule-item" key={`${day.key}-${item.title}-${index}`}>
                      <span>{item.title}</span>
                      <strong>{item.hours}h</strong>
                    </div>
                  ))
                ) : (
                  <div className="schedule-empty">Recovery block or review session</div>
                )}
              </div>
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}
