import { WEEKDAYS } from "@/utils/scheduleUtils";
import "./weekday-picker.css";

// Weekday toggles (Figma D4 and TR-2): one round button per day, Monday first. `value` is the picked days as
// Date#getDay numbers and `onChange` gets the new list. `days` is [{ value, long, label? }] (the default is the
// whole week); a button shows `label`, or the first letter of the day's name. Name the group with `labelId`
// (Field passes it) or `label`.
export default function WeekdayPicker({ value, onChange, days = WEEKDAYS, labelId, label, className = "" }) {
  const toggle = (day) => onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day]);
  return (
    <div role="group" aria-labelledby={labelId} aria-label={label} className={`ui-weekdays ${className}`.trim()}>
      {days.map((day) => (
        <button
          key={day.value}
          type="button"
          className="ui-weekday"
          aria-pressed={value.includes(day.value)}
          aria-label={day.long}
          onClick={() => toggle(day.value)}
        >
          {day.label ?? day.long[0]}
        </button>
      ))}
    </div>
  );
}
