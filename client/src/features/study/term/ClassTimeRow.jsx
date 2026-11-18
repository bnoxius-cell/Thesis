import { Trash2, TriangleAlert } from "lucide-react";
import { Field, WeekdayPicker } from "@/shared/ui";
import DayTimes from "@/features/plan/DayTimes";
import { setDays } from "@/utils/classTimes";
import { ENTRY_ROOM_MAX } from "@/utils/entryForm";
import "./term.css";

// One class time of a new subject (TR-3, and the Add subject dialog, MS-1; Figma P7a 442:4245, phone 442:4577): a
// card with its days (Monday to Sunday), "Same time every day" with the times (one Starts and Ends, or a time for
// each day), a room, and Remove. `time` is a class time of newTermForm.js and `onChange` gets the fields that
// changed. `error` is a plain message that blocks Next (or the save); `note` is a clash warning that never does.
export default function ClassTimeRow({ time, position, error, note, onChange, onRemove }) {
  const noDays = time.days.length === 0;
  return (
    <div role="group" aria-label={`Class time ${position}`} className={`term-time${time.fresh ? " is-entering" : ""}`}>
      <div className="term-time__head">
        <h4 className="term-time__title">Class time {position}</h4>
        <button type="button" className="term-quiet term-time__remove" aria-label={`Remove class time ${position}`} onClick={onRemove}>
          <Trash2 size={16} aria-hidden="true" />
          <span>Remove</span>
        </button>
      </div>
      <WeekdayPicker label="Days" value={time.days} onChange={(days) => onChange(setDays(time, days))} />
      {error && noDays && <p className="term-time__error" role="alert">{error}</p>}
      <DayTimes time={time} onChange={onChange} error={noDays ? "" : error} removable={false} />
      <Field
        label="Room (optional)"
        placeholder="e.g. Lab 2"
        value={time.location}
        maxLength={ENTRY_ROOM_MAX}
        autoComplete="off"
        onChange={(e) => onChange({ location: e.target.value })}
      />
      {note && (
        <p className="term-note term-note--watch" role="status">
          <TriangleAlert size={20} aria-hidden="true" />
          <span>{note}</span>
        </p>
      )}
    </div>
  );
}
