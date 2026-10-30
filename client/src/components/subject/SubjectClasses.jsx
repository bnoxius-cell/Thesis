import { CalendarDays } from "lucide-react";
import EmptyState from "../EmptyState";
import { formatTime, fromISODate } from "../../utils/scheduleUtils";

const dayName = (iso) => fromISODate(iso).toLocaleDateString("en-US", { weekday: "short" });

// This week's classes for one subject, from the main schedule. `classes` is [{ iso, entry }] from
// classesThisWeek; `loaded` is false until the timetable has arrived.
export default function SubjectClasses({ classes, loaded }) {
  return (
    <section className="panel subject-card" aria-labelledby="subject-classes-title">
      <h2 id="subject-classes-title">This week's classes</h2>
      {!loaded ? (
        <p className="subject-note">Loading your timetable...</p>
      ) : classes.length === 0 ? (
        <EmptyState compact icon={CalendarDays} title="No classes this week">
          Classes on your main schedule with this name show up here.
        </EmptyState>
      ) : (
        <ul className="subject-classes">
          {classes.map(({ iso, entry }) => (
            <li key={`${iso}-${entry._id ?? entry.startTime}`} className="subject-class">
              <span className="subject-class-day">{dayName(iso)}</span>
              <span className="subject-class-body">
                <strong>{formatTime(entry.startTime)} to {formatTime(entry.endTime)}</strong>
                {entry.location && <small>{entry.location}</small>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
