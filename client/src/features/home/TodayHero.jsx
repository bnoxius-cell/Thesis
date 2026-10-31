import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { Card } from "@/shared/ui";
import { todayEmptyText, todayHeadline } from "./todayHeadline";
import { EntryRow, TaskRow } from "./TodayRows";

const MAX_ROWS = 4;
// Tasks always keep a couple of seats, so an overdue one is never pushed out by a full timetable.
const MIN_TASK_SEATS = 2;

// The Today hero (Figma 16:46): what is on now or next, then up to four rows of classes and the tasks
// due today. `tasks` are open tasks due today or overdue, most urgent first. It carries the page's one
// ambient layer.
export default function TodayHero({ focus, today, tasks, subjectsById, now, isNewUser, onToggle }) {
  const entries = [...focus.happeningNow, ...focus.laterToday];
  const taskSeats = Math.min(tasks.length, Math.max(MIN_TASK_SEATS, MAX_ROWS - entries.length));
  const shownEntries = entries.slice(0, MAX_ROWS - taskSeats);
  const shownTasks = tasks.slice(0, taskSeats);
  const hidden = entries.length - shownEntries.length + tasks.length - shownTasks.length;
  const hiddenAreTasks = entries.length === shownEntries.length;
  const headline = todayHeadline({ focus, tasks, now });

  return (
    <Card as="section" className="home-hero ambient" aria-labelledby="home-today">
      <header className="home-card__head">
        <span className="home-chip" aria-hidden="true"><CalendarDays size={18} /></span>
        <h2 id="home-today" className="home-card__title">Today</h2>
      </header>

      {headline ? (
        <div className="home-hero__headline">
          <p className="home-hero__title">{headline.title}</p>
          <p className="home-hero__detail">{headline.detail}</p>
        </div>
      ) : (
        <p className="home-hero__empty">{todayEmptyText({ focus, today, isNewUser })}</p>
      )}

      {shownEntries.length + shownTasks.length > 0 && (
        <ul className="home-rows stagger" aria-label="Classes and tasks for today">
          {shownEntries.map((entry, i) => (
            <EntryRow key={`${entry.title}-${entry.startTime}-${i}`} entry={entry} live={focus.happeningNow.includes(entry)} />
          ))}
          {shownTasks.map((task) => (
            <TaskRow key={task._id} task={task} subject={subjectsById.get(task.subject)} now={now} onToggle={onToggle} />
          ))}
        </ul>
      )}

      {hidden > 0 && (
        <Link to={hiddenAreTasks ? "/plan?view=tasks" : "/plan"} className="home-hero__more">
          +{hidden} more in Plan
        </Link>
      )}
    </Card>
  );
}
