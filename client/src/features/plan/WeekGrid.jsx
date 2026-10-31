import EntryBlock from "./EntryBlock";
import HolidayNote from "./HolidayNote";
import LoadDot from "./LoadDot";
import TaskChip from "./TaskChip";

// The week as seven columns, Monday to Sunday (Figma 38:3): the day, its load dot, then the day's
// classes and tasks. Today's column is tinted. `direction` ("next", "prev" or "none") is which way
// the week was stepped, so the new week slides in from that side.
export default function WeekGrid({ days, now, onToggle, direction }) {
  return (
    <ol className="plan-grid" data-direction={direction} aria-label="This week by day">
      {days.map((day) => (
        <li key={day.key} className={`plan-col${day.isToday ? " is-today" : ""}`} aria-label={day.label} aria-current={day.isToday ? "date" : undefined}>
          <header className="plan-col__head">
            <div>
              <p className="plan-col__name">{day.weekday}</p>
              <span className="plan-col__num">{day.dayNumber}</span>
            </div>
            <LoadDot load={day.load} />
            <span className="sr-only">{day.load === "heavy" ? "Heavy day" : "Light day"}</span>
          </header>
          <ul className="plan-col__items">
            {day.holiday && <HolidayNote name={day.holiday} />}
            {day.entries.map((entry) => <EntryBlock key={entry.id} entry={entry} />)}
            {day.tasks.map((item) => <TaskChip key={item.task._id} item={item} now={now} onToggle={onToggle} />)}
          </ul>
        </li>
      ))}
    </ol>
  );
}
