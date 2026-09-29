import { ChevronLeft, ChevronRight, CalendarOff, Plus, MapPin } from "lucide-react";
import {
  WEEKDAYS, ENTRY_ICONS, addDays, toISODate, entryOccursOn, formatTime, defaultIconFor, resolveHoliday,
} from "../../utils/scheduleUtils";

const rangeLabel = (start) => {
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startText = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endText = end.toLocaleDateString(undefined, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" });
  return `${startText} to ${endText}, ${end.getFullYear()}`;
};

function EntryCard({ entry, suspended, canEdit, onOpen }) {
  const Icon = ENTRY_ICONS[entry.icon] || ENTRY_ICONS[defaultIconFor(entry.kind)];
  const style = entry.color ? { "--entry-color": entry.color } : undefined;
  const body = (
    <>
      <span className="sched-thumb">
        {entry.image ? <img src={entry.image} alt="" loading="lazy" /> : <Icon size={20} aria-hidden="true" />}
      </span>
      <span className="sched-entry-text">
        <span className="sched-entry-time">{formatTime(entry.startTime)} to {formatTime(entry.endTime)}</span>
        <strong>{entry.title}</strong>
        {entry.location && (
          <span className="sched-entry-meta"><MapPin size={12} aria-hidden="true" /> {entry.location}</span>
        )}
        {entry.notes && <span className="sched-entry-meta">{entry.notes}</span>}
        {suspended && <span className="sched-tag">No class today</span>}
      </span>
    </>
  );
  const className = `sched-entry kind-${entry.kind} ${suspended ? "is-suspended" : ""}`;
  return canEdit ? (
    <button type="button" className={className} style={style} onClick={() => onOpen(entry)}>{body}</button>
  ) : (
    <div className={className} style={style}>{body}</div>
  );
}

// One week, Monday to Sunday. Wide screens show seven columns, narrow screens stack the
// days into a single list, so nothing ever needs sideways scrolling.
export default function WeekView({
  weekStart, entries, overrides, publicByDate, canEdit, onShiftWeek, onToday, onAddEntry, onOpenEntry, onMarkDay,
}) {
  const todayIso = toISODate(new Date());
  const days = WEEKDAYS.map((_, i) => addDays(weekStart, i));

  return (
    <section className="sched-week" aria-label="Weekly schedule">
      <div className="sched-week-bar">
        <div className="sched-week-nav">
          <button type="button" className="sched-icon-button" onClick={() => onShiftWeek(-1)} aria-label="Previous week">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <h2>{rangeLabel(weekStart)}</h2>
          <button type="button" className="sched-icon-button" onClick={() => onShiftWeek(1)} aria-label="Next week">
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button type="button" className="secondary-button small" onClick={onToday}>This week</button>
        </div>
      </div>

      <div className="sched-days">
        {days.map((day) => {
          const iso = toISODate(day);
          const holiday = resolveHoliday(iso, publicByDate, overrides);
          const dayEntries = entries
            .filter((e) => entryOccursOn(e, iso))
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
          const label = day.toLocaleDateString(undefined, { weekday: "short" });
          return (
            <div key={iso} className={`sched-day ${iso === todayIso ? "is-today" : ""} ${holiday ? "is-holiday" : ""}`}>
              <header className="sched-day-head">
                <div>
                  <span className="sched-day-name">{label}</span>
                  <span className="sched-day-date">{day.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                </div>
                <div className="sched-day-tools">
                  {canEdit && (
                    <>
                      <button type="button" className="sched-icon-button" onClick={() => onAddEntry(iso)} aria-label={`Add something on ${label}`}>
                        <Plus size={16} aria-hidden="true" />
                      </button>
                      <button type="button" className="sched-icon-button" onClick={() => onMarkDay(iso)} aria-label={`Holiday settings for ${label} ${day.getDate()}`}>
                        <CalendarOff size={16} aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </header>

              {holiday && <div className="sched-holiday-banner">{holiday.name}</div>}

              <div className="sched-day-body">
                {dayEntries.length === 0 ? (
                  <p className="sched-day-empty">{holiday ? "Enjoy the day off." : "Nothing planned."}</p>
                ) : (
                  dayEntries.map((entry) => (
                    <EntryCard
                      key={entry._id}
                      entry={entry}
                      suspended={Boolean(holiday) && entry.skipOnHoliday}
                      canEdit={canEdit}
                      onOpen={onOpenEntry}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
