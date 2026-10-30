import { Link } from "react-router-dom";
import { dueChip, taskEditLabel } from "../../utils/dueChip";
import useEnteringIds from "../../utils/useEnteringIds";
import TaskCheck from "../TaskCheck";
import SubjectDot from "../subject/SubjectDot";

export const COMING_UP_MAX = 5;

const TONE_CLASS = { danger: "is-danger", watch: "is-watch", neutral: "is-neutral" };

// Tasks due in the next 7 days (not today, which the Today list covers), soonest first.
// `tasks` come from useWorkload().enrichedTasks, so each has `daysLeft`.
//   subjectsById             Map of the student's subjects, for the dot before a linked task's course
//   onComplete(task, done)   tick a task off; resolves to false if it didn't save
//   onEdit(task)             open the task dialog
export default function ComingUp({ tasks, subjectsById, now, onComplete, onEdit }) {
  const rows = tasks.slice(0, COMING_UP_MAX);
  const more = tasks.length - rows.length;
  const entering = useEnteringIds(rows.map((task) => task._id));
  if (tasks.length === 0) return null;

  return (
    <section className="panel today-card coming-up" data-tour="dash-coming">
      <div className="today-card-head"><h2>Coming up</h2></div>
      <ul className="row-list stagger">
        {rows.map((task) => {
          const chip = dueChip(task.dueDate, now);
          return (
            <li key={task._id} className={`row-item task-item${entering.has(task._id) ? " is-entering" : ""}`}>
              <TaskCheck task={task} onChange={onComplete} />
              <button type="button" className="row-main row-edit" onClick={() => onEdit(task)} aria-label={taskEditLabel(task, now)}>
                <strong>{task.title}</strong>
                <span className={`row-meta${task.course ? "" : " is-empty"}`}>{subjectsById.has(task.subject) && <SubjectDot color={subjectsById.get(task.subject).color} />}{task.course || "No course"}</span>
              </button>
              <span className={`chip ${TONE_CLASS[chip.tone] || "is-neutral"}`}>{chip.label}</span>
            </li>
          );
        })}
      </ul>
      {more > 0 && <Link to="/plan?view=tasks" className="today-more">+{more} more in Tasks</Link>}
    </section>
  );
}
