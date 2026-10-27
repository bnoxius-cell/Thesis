import { Link } from "react-router-dom";
import { CalendarDays, CircleCheck, MapPin } from "lucide-react";
import JoinLink from "../schedule/JoinLink";
import { dueChip } from "../../utils/dueChip";
import { formatTime, fromISODate } from "../../utils/scheduleUtils";

export const TODAY_MAX_ROWS = 5;

// Shown when nothing is on and nothing is due, worded for the time of day.
const QUIET_MESSAGE = {
  morning: "A clear morning. A good time to get ahead on something, or just to breathe.",
  afternoon: "Nothing on and nothing due. Enjoy the breathing room.",
  evening: "Nothing left for today. You can switch off.",
  night: "Nothing left for today. Time to rest.",
};

const TONE_CLASS = { danger: "is-danger", watch: "is-watch", neutral: "is-neutral" };

const shortDate = (iso) => fromISODate(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

// "Tomorrow: 3 classes, the first at 8:00 AM." / a day off / nothing.
function tomorrowLine(tomorrow) {
  if (tomorrow.holiday) return `Tomorrow is a day off (${tomorrow.holiday}).`;
  const all = tomorrow.entries;
  if (all.length === 0) return "Nothing scheduled tomorrow.";
  const count = all.length + tomorrow.moreEntries;
  return `Tomorrow: ${count} ${count === 1 ? "entry" : "entries"}, the first at ${formatTime(all[0].startTime)}.`;
}

function EntryRow({ entry, live }) {
  const kind = entry.kind || "class";
  return (
    <li className={`row-item${live ? " is-live" : ""}`}>
      <div className="row-main">
        <strong>{entry.title}</strong>
        <span className="row-meta">
          {formatTime(entry.startTime)} to {formatTime(entry.endTime)}
          {entry.location && <><span aria-hidden="true"> · </span><MapPin size={14} aria-hidden="true" />{entry.location}</>}
        </span>
      </div>
      <div className="row-end">
        {live && <span className="chip is-accent">Now</span>}
        {kind === "exam" && <span className="chip is-watch">Exam</span>}
        {kind === "event" && <span className="chip is-neutral">Event</span>}
        {entry.meetingUrl && <JoinLink url={entry.meetingUrl} className="tonal-button" />}
      </div>
    </li>
  );
}

function TaskRow({ task, now }) {
  const chip = dueChip(task.dueDate, now);
  return (
    <li className="row-item">
      <div className="row-main">
        <strong>{task.title}</strong>
        {task.course && <span className="row-meta">{task.course}</span>}
      </div>
      <div className="row-end">
        <span className={`chip ${TONE_CLASS[chip.tone] || "is-neutral"}`}>{chip.label}</span>
      </div>
    </li>
  );
}

// One merged list: classes happening now and later, then tasks due today or overdue. At most five
// rows; tasks always keep a couple of seats so an overdue one is never pushed out by a full timetable.
export default function TodayCard({ focus, today, tasks, now, nextExam, hasSchedule }) {
  const live = focus.happeningNow;
  const later = focus.laterToday;
  const entries = [...live, ...later];

  const taskSlots = Math.min(tasks.length, Math.max(2, TODAY_MAX_ROWS - entries.length));
  const entrySlots = Math.min(entries.length, TODAY_MAX_ROWS - taskSlots);
  const shownEntries = entries.slice(0, entrySlots);
  const shownTasks = tasks.slice(0, taskSlots);
  const hidden = entries.length - shownEntries.length + tasks.length - shownTasks.length;
  const hiddenIsTasks = entries.length === shownEntries.length;
  const hasRows = shownEntries.length + shownTasks.length > 0;

  return (
    <section className="panel today-card" data-tour="dash-today">
      <div className="today-card-head"><h2>Today</h2></div>

      {today.holiday && (
        <p className="today-note"><CalendarDays size={16} aria-hidden="true" /><span>{today.holiday}. Classes that skip holidays are off today.</span></p>
      )}

      {nextExam && nextExam.daysLeft > 0 && (
        <p className="today-note">
          <CalendarDays size={16} aria-hidden="true" />
          <span>Next exam: <strong>{nextExam.title}</strong>, {shortDate(nextExam.date)} at {formatTime(nextExam.startTime)}</span>
        </p>
      )}

      {hasRows && (
        <ul className="row-list" aria-label="Today's classes and tasks">
          {shownEntries.map((entry, i) => (
            <EntryRow key={`${entry.title}-${entry.startTime}-${i}`} entry={entry} live={live.includes(entry)} />
          ))}
          {shownTasks.map((task) => <TaskRow key={task._id} task={task} now={now} />)}
        </ul>
      )}

      {hidden > 0 && (
        <Link to={hiddenIsTasks ? "/schedule?tab=tasks" : "/schedule"} className="today-more">
          +{hidden} more{hiddenIsTasks ? " in Tasks" : " in your schedule"}
        </Link>
      )}

      {focus.finishedCount > 0 && <p className="today-quiet">{focus.finishedCount} finished earlier today.</p>}

      {!hasRows && (
        focus.caughtUp ? (
          <p className="today-empty"><CircleCheck size={20} aria-hidden="true" /><span><strong>You're all caught up.</strong> No open tasks right now. Enjoy it, or use the time to plan ahead.</span></p>
        ) : (
          <>
            {focus.nextTask && (
              <p className="today-quiet">Nothing due right now. Next up is <strong>{focus.nextTask.title}</strong>, due in {focus.nextTask.daysLeft} days.</p>
            )}
            {focus.finishedCount === 0 && (
              <p className="today-quiet">{today.holiday ? "A day off, and nothing due. Enjoy it." : QUIET_MESSAGE[focus.phase]}</p>
            )}
          </>
        )
      )}

      {focus.tomorrow && <p className="today-quiet">{tomorrowLine(focus.tomorrow)}</p>}

      {!hasSchedule && (
        <div className="today-card-foot">
          <Link to="/schedule" className="ghost-button"><CalendarDays size={16} aria-hidden="true" />Add your classes</Link>
        </div>
      )}
    </section>
  );
}
