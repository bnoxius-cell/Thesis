import EntryBlock from "./EntryBlock";
import HolidayNote from "./HolidayNote";
import LoadDot from "./LoadDot";
import TaskChip from "./TaskChip";

// The week as seven columns, Monday to Sunday (Figma 38:3): the day, its load dot, then the day's
// classes and tasks. Today's column is tinted. `direction` ("next", "prev" or "none") is which way
// the week was stepped, so the new week slides in from that side. Entries and tasks open their details
// window through `onOpenEntry(entry, iso)` and `onOpenTask(task)`; `foundDay` is the day a link landed on
// (`?day=`), whose column flashes. Empty space in a column does too. The day name and number open the day window through `onOpenDay(day)`.
// A click on empty space in a column opens the day too (mouse only: keyboard and screen readers use the
// header button). Anything interactive inside, or a row that opens its own window, keeps its own click.
const OWN_CLICK = "button, a, input, label, select, textarea, .item-row";

export default function WeekGrid({ days, now, onToggle, onOpenEntry, onOpenTask, onOpenDay, foundDay, direction }) {
  return (
    <ol className="plan-grid plan-slide" data-direction={direction} aria-label="This week by day">
      {days.map((day) => (
        <li key={day.key} className={`plan-col${day.isToday ? " is-today" : ""}${day.key === foundDay ? " is-found" : ""}`} aria-label={day.label} aria-current={day.isToday ? "date" : undefined} onClick={(e) => { if (!e.target.closest(OWN_CLICK)) onOpenDay(day); }}>
          <header className="plan-col__head">
            <button type="button" className="plan-col__open" aria-haspopup="dialog" aria-label={`Open ${day.label}`} onClick={() => onOpenDay(day)}>
              <span className="plan-col__name">{day.weekday}</span>
              <span className="plan-col__num">{day.dayNumber}</span>
            </button>
            <LoadDot load={day.load} />
            <span className="sr-only">{day.load === "heavy" ? "Heavy day" : "Light day"}</span>
          </header>
          <ul className="plan-col__items">
            {day.holiday && <HolidayNote name={day.holiday} />}
            {day.entries.map((entry) => <EntryBlock key={entry.id} entry={entry} iso={day.key} onOpen={onOpenEntry} />)}
            {day.tasks.map((item) => <TaskChip key={item.task._id} item={item} now={now} onToggle={onToggle} onOpen={onOpenTask} />)}
          </ul>
        </li>
      ))}
    </ol>
  );
}
