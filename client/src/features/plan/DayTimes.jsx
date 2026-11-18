import { useId } from "react";
import { Plus, TriangleAlert, X } from "lucide-react";
import { IconButton, Switch } from "@/shared/ui";
import { WEEKDAYS } from "@/utils/scheduleUtils";
import { addNextDay, changeDayTime, dayTimeRows, isPerDay, nextFreeDay, setDays, setSameTime, timeProblem } from "@/utils/classTimes";
import "./day-times.css";

const NAMES = Object.fromEntries(WEEKDAYS.map((day) => [day.value, day]));

// The times of one class time (Figma P7a: Plan 441:3947 and 441:4152, Add subject 442:4245, phones 441:4650 and
// 442:4577): "Same time every day" on shows one Starts and Ends, off lists each picked day with its own times and
// "Add another day" (copies the last row onto the next free weekday). The days are picked above, by the caller
// (`setDays` from utils/classTimes.js keeps the per-day times in step). `time` is { days, startTime, endTime,
// sameTime, dayTimes }; `onChange` gets the whole time with the change made. `error` is the message for the
// times, shown under the row it names; with no days picked the times are greyed ("Pick the days first.").
// `canSplit` false hides the switch, for editing one stored entry (it has one time). `needDays` false is for a
// one-day class, which has a date, not days. `removable` adds an X on each day's row, which unpicks the day.
export default function DayTimes({ time, onChange, error = "", canSplit = true, needDays = true, removable = true }) {
  const id = useId();
  const noDays = needDays && time.days.length === 0;
  const perDay = canSplit && isPerDay(time) && time.days.length > 0;
  const errorDay = error ? timeProblem(time)?.day : null;
  const errorId = error ? `${id}-error` : undefined;
  const set = (fields) => onChange({ ...time, ...fields });

  const errorLine = (
    <p id={errorId} className="day-times__error" role="alert">
      <TriangleAlert size={16} aria-hidden="true" />
      <span>{error}</span>
    </p>
  );
  const hint = noDays ? "Pick the days first." : isPerDay(time) ? "Each day has its own time." : "All the days share one time.";

  return (
    <div className="day-times">
      {canSplit && (
        <div className="day-times__switch">
          <span className="day-times__switch-text">
            <span id={`${id}-label`} className="day-times__title">Same time every day</span>
            <span className="day-times__hint">{hint}</span>
          </span>
          <Switch
            checked={!isPerDay(time)}
            onChange={(same) => onChange(setSameTime(time, same))}
            labelId={`${id}-label`}
          />
        </div>
      )}
      {perDay ? (
        <div className="day-times__rows">
          {dayTimeRows(time).map(({ day, startTime, endTime }) => {
            const bad = errorDay === day;
            const name = NAMES[day].long;
            return (
              <div key={day} role="group" aria-label={name} className="day-times__item">
                <div className="day-times__row">
                  <span className="day-times__day">{NAMES[day].short}</span>
                  <input
                    type="time"
                    className="ui-field__control day-times__start"
                    aria-label={`${name} starts`}
                    aria-invalid={bad || undefined}
                    aria-describedby={bad ? errorId : undefined}
                    value={startTime}
                    onChange={(e) => onChange(changeDayTime(time, day, { startTime: e.target.value }))}
                  />
                  <span className="day-times__to" aria-hidden="true">to</span>
                  <input
                    type="time"
                    className="ui-field__control day-times__end"
                    aria-label={`${name} ends`}
                    aria-invalid={bad || undefined}
                    aria-describedby={bad ? errorId : undefined}
                    value={endTime}
                    onChange={(e) => onChange(changeDayTime(time, day, { endTime: e.target.value }))}
                  />
                  {removable && (
                    <IconButton
                      plain
                      icon={X}
                      label={`Remove ${name}`}
                      className="day-times__remove"
                      onClick={() => onChange(setDays(time, time.days.filter((other) => other !== day)))}
                    />
                  )}
                </div>
                {bad && errorLine}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="day-times__pair">
          {["Starts", "Ends"].map((label) => {
            const key = label === "Starts" ? "startTime" : "endTime";
            return (
              <label key={key} className="day-times__field">
                <span className="ui-field__label">{label}</span>
                <input
                  type="time"
                  className="ui-field__control"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={errorId}
                  disabled={noDays}
                  value={time[key]}
                  onChange={(e) => set({ [key]: e.target.value })}
                />
              </label>
            );
          })}
        </div>
      )}
      {error && !(perDay && errorDay != null) && errorLine}
      {perDay && nextFreeDay(time.days) !== undefined && (
        <button type="button" className="day-times__add" onClick={() => onChange(addNextDay(time))}>
          <Plus size={18} aria-hidden="true" />
          <span>Add another day</span>
        </button>
      )}
    </div>
  );
}
