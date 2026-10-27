import { Link } from "react-router-dom";
import { dueChip } from "../../utils/dueChip";

export const COMING_UP_MAX = 5;

const TONE_CLASS = { danger: "is-danger", watch: "is-watch", neutral: "is-neutral" };

// Tasks due in the next 7 days (not today, which the Today list covers), soonest first.
// `tasks` come from useWorkload().enrichedTasks, so each has `daysLeft`.
export default function ComingUp({ tasks, now }) {
  const rows = tasks.slice(0, COMING_UP_MAX);
  const more = tasks.length - rows.length;
  if (tasks.length === 0) return null;

  return (
    <section className="panel today-card coming-up" data-tour="dash-coming">
      <div className="today-card-head"><h2>Coming up</h2></div>
      <ul className="row-list">
        {rows.map((task) => {
          const chip = dueChip(task.dueDate, now);
          return (
            <li key={task._id} className="row-item">
              <div className="row-main">
                <strong>{task.title}</strong>
                {task.course && <span className="row-meta">{task.course}</span>}
              </div>
              <span className={`chip ${TONE_CLASS[chip.tone] || "is-neutral"}`}>{chip.label}</span>
            </li>
          );
        })}
      </ul>
      {more > 0 && <Link to="/schedule?tab=tasks" className="today-more">+{more} more in Tasks</Link>}
    </section>
  );
}
