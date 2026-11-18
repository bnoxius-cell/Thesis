import { useRef } from "react";
import { WEEKDAYS } from "@/utils/scheduleUtils";
import "./weekday-picker.css";

// Weekday toggles (Figma D4 and TR-2): one round button per day, Monday first. `value` is the picked days as
// Date#getDay numbers and `onChange` gets the new list. `days` is [{ value, long, label? }] (the default is the
// whole week); a button shows `label`, or the first letter of the day's name. Name the group with `labelId`
// (Field passes it) or `label`.
export default function WeekdayPicker({ value, onChange, days = WEEKDAYS, labelId, label, className = "" }) {
  // Two clicks in one tick would both read the same `value`, so the latest picked days are kept in a ref.
  const latest = useRef(value);
  latest.current = value;
  const toggle = (day) => {
    const current = latest.current;
    latest.current = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    onChange(latest.current);
  };
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
