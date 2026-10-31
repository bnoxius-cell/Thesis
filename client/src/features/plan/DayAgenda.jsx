import { Chip } from "@/shared/ui";
import EntryBlock from "./EntryBlock";
import HolidayNote from "./HolidayNote";
import TaskChip from "./TaskChip";

// What is on for the chosen day (Figma 40:387): overdue tasks first, then the day off if there is
// one, the classes in time order, then the rest of the day's tasks.
export default function DayAgenda({ day, now, onToggle }) {
  const overdue = day.tasks.filter((item) => item.overdue);
  const dueToday = day.tasks.filter((item) => !item.overdue);
  const empty = !day.holiday && day.entries.length === 0 && day.tasks.length === 0;
  const task = (item) => <TaskChip key={item.task._id} item={item} now={now} onToggle={onToggle} roomy />;

  return (
    <section id="plan-agenda" role="tabpanel" aria-labelledby={`plan-tab-${day.key}`} className="plan-agenda">
      <header className="plan-agenda__head">
        <h2 className="plan-agenda__title">{day.label}</h2>
        {day.isToday && <Chip tone="accent">Today</Chip>}
      </header>
      {empty ? (
        <p className="plan-agenda__empty">Nothing is planned for this day.</p>
      ) : (
        <ul className="plan-agenda__list">
          {overdue.map(task)}
          {day.holiday && <HolidayNote name={day.holiday} />}
          {day.entries.map((entry) => <EntryBlock key={entry.id} entry={entry} />)}
          {dueToday.map(task)}
        </ul>
      )}
    </section>
  );
}
