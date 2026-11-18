import { TriangleAlert, X } from "lucide-react";
import { Field, WeekdayPicker } from "@/shared/ui";
import { ENTRY_ROOM_MAX } from "@/utils/entryForm";
import "./term.css";

// One class time of a new subject (TR-3, and the Add subject dialog, MS-1): the days (Monday to Sunday), a start
// and an end time (the native time inputs the class form uses), a room, and Remove. On a phone each part has its
// own row with a visible label. `error` is a plain message that blocks Next (or the save); `note` is a clash
// warning that never does.
export default function ClassTimeRow({ time, position, error, note, onChange, onRemove }) {
  return (
    <div role="group" aria-label={`Class time ${position}`} className={`term-time${time.fresh ? " is-entering" : ""}`}>
      <div className="term-time__row">
        <WeekdayPicker label="Days" value={time.days} onChange={(days) => onChange({ days })} className="term-time__days" />
        <Field label="Start" type="time" className="term-time__start" value={time.startTime} onChange={(e) => onChange({ startTime: e.target.value })} />
        <Field label="End" type="time" className="term-time__end" value={time.endTime} onChange={(e) => onChange({ endTime: e.target.value })} />
        <Field
          label="Room"
          className="term-time__room"
          placeholder="Room"
          value={time.location}
          maxLength={ENTRY_ROOM_MAX}
          autoComplete="off"
          onChange={(e) => onChange({ location: e.target.value })}
        />
        <button type="button" className="term-quiet term-time__remove" onClick={onRemove}>
          <X size={20} aria-hidden="true" />
          <span>Remove class time</span>
        </button>
      </div>
      {error && <p className="term-time__error" role="alert">{error}</p>}
      {note && (
        <p className="term-note term-note--watch" role="status">
          <TriangleAlert size={20} aria-hidden="true" />
          <span>{note}</span>
        </p>
      )}
    </div>
  );
}
