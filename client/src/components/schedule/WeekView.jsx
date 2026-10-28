import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarOff, Plus, MapPin, ClipboardCheck } from "lucide-react";
import {
  WEEKDAYS, ENTRY_ICONS, addDays, toISODate, entryOccursOn, formatTime, defaultIconFor, resolveHoliday,
} from "../../utils/scheduleUtils";
import { overlapsOnDay } from "../../utils/scheduleConflicts";
import useEnteringIds from "../../utils/useEnteringIds";
import JoinLink from "./JoinLink";

const rangeLabel = (start) => {
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startText = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endText = end.toLocaleDateString(undefined, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" });
  return `${startText} to ${endText}, ${end.getFullYear()}`;
};

// "9:00-10:30 AM" when both ends share AM or PM, so a narrow column fits it on one line. Screen
// readers get the full "9:00 AM to 10:30 AM" from the entry's button label.
const timeRange = (start, end) => {
  const from = formatTime(start);
  const to = formatTime(end);
  return from.slice(-2) === to.slice(-2) ? `${from.slice(0, -3)}-${to}` : `${from}-${to}`;
};

// The whole block opens the entry (an invisible button covers it), and the Join link sits on
// top so a tap on it goes to the meeting instead.
function EntryCard({ entry, suspended, clash, canEdit, entering, onOpen }) {
  const Icon = ENTRY_ICONS[entry.icon] || ENTRY_ICONS[defaultIconFor(entry.kind)];
  const style = entry.color ? { "--entry-color": entry.color } : undefined;
  const time = timeRange(entry.startTime, entry.endTime);
  const spokenTime = `${formatTime(entry.startTime)} to ${formatTime(entry.endTime)}`;
  return (
    <div className={`sched-entry kind-${entry.kind}${suspended ? " is-suspended" : ""}${entering ? " is-entering" : ""}`} style={style}>
      <button
        type="button"
        className="sched-entry-hit"
        onClick={() => onOpen(entry)}
        aria-label={`${canEdit ? "Edit" : "Details for"} ${entry.title}, ${spokenTime}`}
      />
      <span className="sched-thumb" aria-hidden="true">
        {entry.image ? <img src={entry.image} alt="" loading="lazy" /> : <Icon size={16} />}
      </span>
      <span className="sched-entry-text">
        <span className="sched-entry-time">{time}</span>
        <strong>{entry.title}</strong>
        {entry.location && (
          <span className="sched-entry-meta"><MapPin size={13} aria-hidden="true" /> {entry.location}</span>
        )}
        {entry.notes && <span className="sched-entry-meta sched-entry-notes">{entry.notes}</span>}
        {(entry.kind === "exam" || suspended || (clash && !suspended)) && (
          <span className="sched-entry-tags">
            {entry.kind === "exam" && <span className="chip is-watch">Exam{entry.prepHours > 0 ? ` · ${entry.prepHours}h study` : ""}</span>}
            {suspended && <span className="chip is-neutral">No class today</span>}
            {clash && !suspended && <span className="chip is-watch sched-clash">Overlaps {clash.join(", ")}</span>}
          </span>
        )}
        {entry.meetingUrl && !suspended && <JoinLink url={entry.meetingUrl} />}
      </span>
    </div>
  );
}

function TaskChip({ task, overdue, onOpen }) {
  const meta = [task.course, `${task.hours}h`].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      className={`sched-due-chip${overdue ? " is-overdue" : ""}`}
      onClick={() => onOpen(task)}
      aria-label={`Task: ${task.title}, ${meta}${overdue ? ", overdue" : ""}`}
    >
      <ClipboardCheck size={16} aria-hidden="true" />
      <span>
        <strong>{task.title}</strong>
        <small>{overdue ? <span className="sched-due-overdue">Overdue</span> : meta}</small>
      </span>
    </button>
  );
}

// One week, Monday to Sunday, in one DOM with two layouts picked by a container query on the
// week itself: a 7-column week when there's room (840px or more), otherwise a day strip and the
// picked day's agenda. Nothing ever needs sideways scrolling.
//
// `tasks` are the viewer's own open tasks (never shared with anyone else on the schedule),
// shown under the day they are due.
export default function WeekView({
  weekStart, entries, overrides, publicByDate, canEdit, onShiftWeek, onToday, onAddEntry, onOpenEntry, onMarkDay,
  mainEntries = [], tasks = [], onOpenTask,
}) {
  const todayIso = toISODate(new Date());
  const days = WEEKDAYS.map((_, i) => addDays(weekStart, i));
  const isos = days.map(toISODate);
  const isThisWeek = isos.includes(todayIso);
  const weekIso = isos[0];

  // The picked day for the phone agenda. It falls back to today when the shown week has it,
  // otherwise to Monday, so moving to another week never leaves an empty agenda.
  const [picked, setPicked] = useState(null);
  const selectedIso = isos.includes(picked) ? picked : isThisWeek ? todayIso : weekIso;
  // Keyboard day changes swap instantly; a tap gets a short fade. Week changes slide a little
  // in the direction of travel.
  const [instant, setInstant] = useState(false);
  const [direction, setDirection] = useState("none");
  const stripRef = useRef(null);
  const entering = useEnteringIds(entries.map((e) => e._id));

  const shiftWeek = (n) => {
    setDirection(n > 0 ? "next" : "prev");
    onShiftWeek(n);
  };
  const goToday = () => {
    setDirection(weekStart > new Date() ? "prev" : "next");
    onToday();
  };

  const pickDay = (iso, byKey) => {
    setInstant(byKey);
    setPicked(iso);
  };
  const onStripKey = (e) => {
    const at = isos.indexOf(selectedIso);
    const next = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: 6 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const iso = isos[Math.max(0, Math.min(6, next))];
    pickDay(iso, true);
    stripRef.current?.querySelector(`[data-iso="${iso}"]`)?.focus();
  };

  const dayInfo = days.map((day, i) => {
    const iso = isos[i];
    const holiday = resolveHoliday(iso, publicByDate, overrides);
    const dayEntries = entries
      .filter((e) => entryOccursOn(e, iso))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const dayTasks = tasks.filter((t) => t.dueIso === iso);
    return { day, iso, holiday, dayEntries, dayTasks };
  });

  return (
    <section className="sched-week" aria-label="Weekly schedule" data-tour="sched-week" data-instant={instant || undefined}>
      <div className="sched-week-bar">
        <button type="button" className="icon-action" onClick={() => shiftWeek(-1)} aria-label="Previous week">
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h2 aria-live="polite">{rangeLabel(weekStart)}</h2>
        <button type="button" className="icon-action" onClick={() => shiftWeek(1)} aria-label="Next week">
          <ChevronRight size={20} aria-hidden="true" />
        </button>
        <button type="button" className="secondary-button small sched-this-week" onClick={goToday} disabled={isThisWeek}>This week</button>
      </div>

      <div className="sched-strip" role="group" aria-label="Pick a day" ref={stripRef} onKeyDown={onStripKey}>
        {dayInfo.map(({ day, iso, holiday, dayEntries, dayTasks }) => {
          const selected = iso === selectedIso;
          const busy = dayEntries.length > 0 || dayTasks.length > 0;
          const weekday = day.toLocaleDateString(undefined, { weekday: "short" });
          return (
            <button
              key={iso}
              type="button"
              data-iso={iso}
              className={`sched-strip-day${iso === todayIso ? " is-today" : ""}${holiday ? " is-holiday" : ""}`}
              aria-pressed={selected}
              tabIndex={selected ? 0 : -1}
              aria-label={`${day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}${iso === todayIso ? ", today" : ""}${busy ? `, ${dayEntries.length + dayTasks.length} planned` : ", free"}${holiday ? `, ${holiday.name}` : ""}`}
              onClick={(e) => pickDay(iso, e.detail === 0)}
            >
              <span className="sched-strip-name">{weekday.slice(0, 3)}</span>
              <span className="sched-strip-num">{day.getDate()}</span>
              <span className={`sched-strip-dot${busy ? " is-on" : ""}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <div className="sched-days" key={weekIso} data-dir={direction}>
        {dayInfo.map(({ day, iso, holiday, dayEntries, dayTasks }) => {
          const label = day.toLocaleDateString(undefined, { weekday: "short" });
          const longLabel = day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
          // Entries on a day off don't clash, so only look at the ones that actually run.
          // An extra schedule is also checked against the main one, so a gaming session that
          // lands on a class gets flagged.
          const mainToday = mainEntries
            .filter((e) => entryOccursOn(e, iso) && !(holiday && e.skipOnHoliday))
            .map((e) => ({ ...e, _id: `main:${e._id}`, title: `${e.title} (main)` }));
          const clashes = overlapsOnDay([...dayEntries.filter((e) => !(holiday && e.skipOnHoliday)), ...mainToday]);
          const empty = dayEntries.length === 0 && dayTasks.length === 0;
          return (
            <div
              key={iso}
              className={`sched-day${iso === todayIso ? " is-today" : ""}${holiday ? " is-holiday" : ""}${iso === selectedIso ? " is-selected" : ""}`}
              aria-label={longLabel}
              role="group"
            >
              <header className="sched-day-head">
                <span className="sched-day-name">
                  <span className="sched-day-short">{label}</span>
                  <span className="sched-day-long">{day.toLocaleDateString(undefined, { weekday: "long" })}</span>
                  <span className="sched-day-date">
                    <span className="sched-day-month">{day.toLocaleDateString(undefined, { month: "short" })} </span>
                    {day.getDate()}
                  </span>
                </span>
                {canEdit && (
                  <button type="button" className="icon-action sched-day-off" onClick={() => onMarkDay(iso)} aria-label={`Day off settings for ${longLabel}`}>
                    <CalendarOff size={16} aria-hidden="true" />
                  </button>
                )}
              </header>

              {holiday && <p className="sched-holiday-banner">{holiday.name}</p>}

              <div className="sched-day-body">
                {empty ? (
                  <p className="sched-day-empty">
                    {holiday ? "Enjoy the day off." : <><span className="sched-day-empty-long">Nothing planned for this day.</span><span className="sched-day-empty-short">Free</span></>}
                  </p>
                ) : (
                  dayEntries.map((entry) => (
                    <EntryCard
                      key={entry._id}
                      entry={entry}
                      suspended={Boolean(holiday) && entry.skipOnHoliday}
                      clash={clashes.get(entry._id)}
                      canEdit={canEdit}
                      entering={entering.has(entry._id)}
                      onOpen={onOpenEntry}
                    />
                  ))
                )}
                {dayTasks.length > 0 && (
                  <div className="sched-due" role="group" aria-label={`Due ${longLabel}`}>
                    <span className="sched-due-label" aria-hidden="true">Due</span>
                    {dayTasks.map((task) => (
                      <TaskChip key={task._id} task={task} overdue={iso < todayIso} onOpen={onOpenTask} />
                    ))}
                  </div>
                )}
                {canEdit && (
                  <button type="button" className="sched-day-add" onClick={() => onAddEntry(iso)} aria-label={`Add something on ${longLabel}`}>
                    <Plus size={16} aria-hidden="true" /> <span>Add</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
