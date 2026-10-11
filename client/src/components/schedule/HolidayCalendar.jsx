import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, X, CalendarPlus, CalendarMinus, RotateCcw, MoveHorizontal } from "lucide-react";
import {
  WEEKDAYS, toISODate, fromISODate, addDays, resolveHoliday, formatLongDate, HOLIDAY_COUNTRY_NAME,
} from "../../utils/scheduleUtils";

const monthLabel = (d) => d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
const shortDate = (iso) => fromISODate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// Every date from the Monday on or before the 1st to the Sunday on or after the last day,
// so the grid is always whole weeks.
const monthGrid = (month) => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  const end = addDays(last, (7 - last.getDay()) % 7);
  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
};

const datesBetween = (a, b) => {
  const [from, to] = a < b ? [a, b] : [b, a];
  const out = [];
  for (let d = fromISODate(from); toISODate(d) <= to; d = addDays(d, 1)) out.push(toISODate(d));
  return out;
};

// A month of days off. Public holidays (Philippines) come filled in, the student's own days
// off stand out in the accent color, and a public holiday they turned back into a normal day
// is shown crossed out. Tap days to select them (shift-click for a range), then act on all of
// them at once from the bar underneath.
//
//   month        first day of the month on show
//   publicByDate date -> public holiday name
//   overrides    the schedule's holidayOverrides
//   onApply      (changes) => error message, or nothing on success
export default function HolidayCalendar({
  month, onMonthChange, publicByDate, overrides, holidayError, canEdit, onApply,
}) {
  const [selected, setSelected] = useState([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lastPicked = useRef(null);

  const todayIso = toISODate(new Date());
  const monthIndex = month.getMonth();
  const days = monthGrid(month);
  const overrideByDate = Object.fromEntries(overrides.map((o) => [o.date, o]));

  const infoFor = (iso) => {
    const holiday = resolveHoliday(iso, publicByDate, overrides);
    const publicName = publicByDate[iso];
    const override = overrideByDate[iso];
    let kind = "regular";
    if (holiday) kind = holiday.source === "public" ? "public" : "own";
    else if (publicName && override?.state === "workday") kind = "cleared";
    return { holiday, publicName, override, kind };
  };

  // This month's days off, in order, for the summary under the grid.
  const monthKey = toISODate(month).slice(0, 7);
  const thisMonth = [...new Set([...Object.keys(publicByDate), ...overrides.map((o) => o.date)])]
    .filter((iso) => iso.startsWith(monthKey))
    .sort()
    .map((iso) => ({ iso, ...infoFor(iso) }))
    .filter((d) => d.kind !== "regular");

  const pick = (iso, e) => {
    if (!canEdit) return;
    setError("");
    if (e.shiftKey && lastPicked.current && lastPicked.current !== iso) {
      const range = datesBetween(lastPicked.current, iso);
      setSelected((s) => [...new Set([...s, ...range])].sort());
    } else {
      setSelected((s) => (s.includes(iso) ? s.filter((d) => d !== iso) : [...s, iso].sort()));
    }
    lastPicked.current = iso;
  };

  const clear = () => {
    setSelected([]);
    setName("");
    setError("");
    lastPicked.current = null;
  };

  const selectedInfo = selected.map((iso) => ({ iso, ...infoFor(iso) }));
  const anyOff = selectedInfo.some((d) => d.holiday);
  const anyOn = selectedInfo.some((d) => !d.holiday);
  const anyOverride = selectedInfo.some((d) => d.override);
  const gaps = selected.length >= 2 && datesBetween(selected[0], selected[selected.length - 1]).length > selected.length;

  const run = async (changes) => {
    if (!changes.length) return;
    setBusy(true);
    const message = await onApply(changes);
    setBusy(false);
    if (message) setError(message);
    else clear();
  };

  // Turning a day off back into a normal day: a public holiday gets a "workday" override,
  // a day off the student added is simply removed.
  const makeDaysOff = () => run(selectedInfo.map((d) => ({ date: d.iso, state: "holiday", name: name.trim() })));
  const removeDaysOff = () => run(selectedInfo.filter((d) => d.holiday).map((d) => ({ date: d.iso, state: d.publicName ? "workday" : null })));
  const resetDays = () => run(selectedInfo.filter((d) => d.override).map((d) => ({ date: d.iso, state: null })));
  const fillGaps = () => setSelected(datesBetween(selected[0], selected[selected.length - 1]));

  const shiftMonth = (n) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const isThisMonth = monthKey === todayIso.slice(0, 7);

  return (
    <section className="panel sched-cal" aria-labelledby="sched-cal-heading" data-tour="sched-cal">
      <div className="sched-cal-head">
        <div>
          <span className="panel-kicker">Days off · {HOLIDAY_COUNTRY_NAME}</span>
          <h2 id="sched-cal-heading">{monthLabel(month)}</h2>
        </div>
        <div className="sched-cal-nav">
          <button type="button" className="sched-icon-button" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          {!isThisMonth && (
            <button type="button" className="secondary-button small" onClick={() => onMonthChange(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
              This month
            </button>
          )}
          <button type="button" className="sched-icon-button" onClick={() => shiftMonth(1)} aria-label="Next month">
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {holidayError && <p className="sched-notice" role="status">{holidayError}</p>}
      {canEdit && (
        <p className="sched-hint sched-cal-help">
          Tap days to select them, then mark them as days off or turn them back into normal days. Shift-click picks a whole range.
        </p>
      )}

      <div className="sched-cal-grid" role="grid" aria-label={`Days off in ${monthLabel(month)}`}>
        <div className="sched-cal-row sched-cal-weekdays" role="row">
          {WEEKDAYS.map((d) => (
            <span key={d.value} role="columnheader" aria-label={d.long}>{d.short}</span>
          ))}
        </div>
        {Array.from({ length: days.length / 7 }, (_, w) => (
          <div className="sched-cal-row" role="row" key={w}>
            {days.slice(w * 7, w * 7 + 7).map((day) => {
              const iso = toISODate(day);
              const { holiday, publicName, kind } = infoFor(iso);
              const outside = day.getMonth() !== monthIndex;
              const isSelected = selected.includes(iso);
              const title = holiday ? holiday.name : kind === "cleared" ? `${publicName} (normal day)` : "";
              const classes = [
                "sched-cal-day",
                `is-${kind}`,
                outside && "is-outside",
                iso === todayIso && "is-today",
                isSelected && "is-selected",
                (day.getDay() === 0 || day.getDay() === 6) && "is-weekend",
              ].filter(Boolean).join(" ");
              const label = `${formatLongDate(iso)}${title ? `, ${title}` : ""}`;
              const body = (
                <>
                  <span className="sched-cal-num">{day.getDate()}</span>
                  {title && <span className="sched-cal-name">{title}</span>}
                </>
              );
              return canEdit ? (
                <button
                  key={iso}
                  type="button"
                  role="gridcell"
                  className={classes}
                  aria-label={label}
                  aria-selected={isSelected}
                  title={title || undefined}
                  onClick={(e) => pick(iso, e)}
                >
                  {body}
                </button>
              ) : (
                <div key={iso} role="gridcell" className={classes} aria-label={label} title={title || undefined}>{body}</div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="sched-cal-legend" aria-hidden="true">
        <span><i className="is-public" /> Public holiday</span>
        <span><i className="is-own" /> Your day off</span>
        <span><i className="is-cleared" /> Normal day (was a holiday)</span>
      </div>

      {canEdit && selected.length > 0 && (
        <div className="sched-cal-bar" role="region" aria-label="Selected days">
          <div className="sched-cal-bar-top">
            <strong>
              {selected.length === 1 ? formatLongDate(selected[0]) : `${selected.length} days selected`}
              {selected.length > 1 && <small>{shortDate(selected[0])} to {shortDate(selected[selected.length - 1])}</small>}
            </strong>
            <button type="button" className="sched-icon-button" onClick={clear} aria-label="Clear the selection" disabled={busy}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="sched-cal-name-row">
            <label htmlFor="cal-day-name" className="visually-hidden">{anyOn ? "Name for the days off" : "New name"}</label>
            <input
              id="cal-day-name"
              type="text"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder={anyOn ? "Name it (optional), e.g., Sem break" : "Rename it (optional)"}
            />
          </div>
          <div className="sched-cal-actions">
            {anyOn && (
              <button type="button" className="primary-button small" onClick={makeDaysOff} disabled={busy}>
                <CalendarPlus size={16} aria-hidden="true" /> {selected.length === 1 ? "Make it a day off" : "Make them days off"}
              </button>
            )}
            {!anyOn && name.trim() && (
              <button type="button" className="primary-button small" onClick={makeDaysOff} disabled={busy}>Save name</button>
            )}
            {anyOff && (
              <button type="button" className="secondary-button small" onClick={removeDaysOff} disabled={busy}>
                <CalendarMinus size={16} aria-hidden="true" /> {selectedInfo.filter((d) => d.holiday).length === 1 ? "Not a day off" : "Not days off"}
              </button>
            )}
            {anyOverride && (
              <button type="button" className="sched-link-button" onClick={resetDays} disabled={busy}>
                <RotateCcw size={14} aria-hidden="true" /> Back to default
              </button>
            )}
            {gaps && (
              <button type="button" className="sched-link-button" onClick={fillGaps} disabled={busy}>
                <MoveHorizontal size={14} aria-hidden="true" /> Fill the days between
              </button>
            )}
          </div>
          {error &&<p className="form-error" role="alert">{error}</p>}
        </div>
      )}

      {thisMonth.length > 0 && (
        <ul className="sched-cal-summary" aria-label={`Days off in ${monthLabel(month)}`}>
          {thisMonth.map((d) => (
            <li key={d.iso} className={`is-${d.kind}`}>
              <span className="sched-cal-summary-date">{fromISODate(d.iso).getDate()}</span>
              <span className="sched-cal-summary-name">
                {d.kind === "cleared" ? <s>{d.publicName}</s> : d.holiday.name}
                <small>{d.kind === "public" ? "Public holiday" : d.kind === "own" ? (d.publicName ? "Renamed" : "Your day off") : "Normal day"}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
      {thisMonth.length === 0 && !holidayError && (
        <p className="schedule-empty sched-cal-empty">No days off this month.{canEdit ? " Tap a day to add one." : ""}</p>
      )}
    </section>
  );
}
