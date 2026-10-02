import { useState } from "react";
import { CalendarOff, Pencil, Plus } from "lucide-react";
import { COUNTRY_CODES, countryName, resolveHoliday, formatLongDate } from "../../utils/scheduleUtils";

// Every holiday in the given year, public and personal, with what the schedule
// currently treats each as. Rows open the shared day editor.
export default function HolidayPanel({
  year, country, publicHolidays, overrides, holidayError, canEdit, canChangeCountry = canEdit, onCountryChange, onPickDate,
}) {
  const [newDate, setNewDate] = useState("");

  const publicByDate = Object.fromEntries(publicHolidays.map((h) => [h.date, h.name]));
  const dates = new Set([
    ...publicHolidays.map((h) => h.date),
    ...overrides.filter((o) => o.date.startsWith(`${year}-`)).map((o) => o.date),
  ]);
  const rows = [...dates].sort().map((date) => {
    const holiday = resolveHoliday(date, publicByDate, overrides);
    return { date, holiday, publicName: publicByDate[date], hasOverride: overrides.some((o) => o.date === date) };
  });

  return (
    <section className="panel sched-holidays" aria-labelledby="holiday-heading">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">Holidays in {year}</span>
          <h2 id="holiday-heading">Days off</h2>
        </div>
        {canChangeCountry ? (
          <label className="sched-country">
            <span>Country</span>
            <select value={country} onChange={(e) => onCountryChange(e.target.value)}>
              {!COUNTRY_CODES.includes(country) && <option value={country}>{countryName(country)}</option>}
              {COUNTRY_CODES.map((code) => (
                <option key={code} value={code}>{countryName(code)}</option>
              ))}
            </select>
          </label>
        ) : (
          <span className="sched-hint">{countryName(country)}</span>
        )}
      </div>

      {holidayError && <p className="sched-notice" role="status">{holidayError}</p>}

      {rows.length === 0 && !holidayError && (
        <p className="schedule-empty">No holidays found for {year}. You can add your own days off below.</p>
      )}

      <ul className="sched-holiday-list">
        {rows.map(({ date, holiday, publicName, hasOverride }) => (
          <li key={date} className={holiday ? "" : "is-off"}>
            <div className="sched-holiday-main">
              <strong>{holiday ? holiday.name : `${publicName} (working day)`}</strong>
              <span>{formatLongDate(date)}</span>
            </div>
            {hasOverride && <span className="sched-tag">{holiday ? (publicName ? "Edited" : "Yours") : "Not a holiday"}</span>}
            {canEdit && (
              <button type="button" className="sched-icon-button" onClick={() => onPickDate(date)} aria-label={`Edit ${formatLongDate(date)}`}>
                <Pencil size={16} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="sched-add-day">
          <label htmlFor="new-day-off">Add your own day off</label>
          <div className="sched-add-day-row">
            <input id="new-day-off" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} min={`${year}-01-01`} max={`${year}-12-31`} />
            <button type="button" className="secondary-button" disabled={!newDate} onClick={() => { onPickDate(newDate); setNewDate(""); }}>
              <Plus size={16} aria-hidden="true" /> Add
            </button>
          </div>
          <span className="sched-hint">
            <CalendarOff size={14} aria-hidden="true" /> You can also use the small button on any day in the week view.
          </span>
        </div>
      )}
    </section>
  );
}
