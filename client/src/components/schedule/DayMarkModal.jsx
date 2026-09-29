import { useState } from "react";
import { formatLongDate } from "../../utils/scheduleUtils";

// Lets a user decide what a single date is: a holiday (with their own name), not a
// holiday (hides a public one), or back to whatever the public list says.
// `holiday` is the resolved state now, `publicName` the public list's name if any.
// `onApply(state, name)` returns an error string on failure. state: "holiday" | "workday" | null.
export default function DayMarkModal({ date, holiday, publicName, hasOverride, onApply, onClose }) {
  const [name, setName] = useState(holiday?.name || publicName || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const apply = async (state) => {
    setBusy(true);
    const message = await onApply(state, name.trim());
    setBusy(false);
    if (message) setError(message);
  };

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <form
        className="modal-content sched-modal sched-modal-narrow"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); apply("holiday"); }}
      >
        <div className="modal-header">
          <h2>{formatLongDate(date)}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <p className="sched-hint sched-mark-status">
          {holiday
            ? `Right now this is a day off: ${holiday.name}.`
            : publicName
              ? `This is normally a public holiday (${publicName}), but you've marked it as a regular day.`
              : "This is a regular day."}
        </p>

        <div className="form-group">
          <label htmlFor="holiday-name">Name for this day off</label>
          <input
            id="holiday-name"
            type="text"
            value={name}
            maxLength={80}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            placeholder="e.g., School break, Founders Day"
            autoFocus
          />
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="sched-mark-actions">
          <button type="submit" className="primary-button" disabled={busy}>
            {holiday ? "Save name" : "Mark as holiday"}
          </button>
          {holiday && (
            <button type="button" className="secondary-button" disabled={busy} onClick={() => apply("workday")}>
              Not a holiday
            </button>
          )}
          {hasOverride && (
            <button type="button" className="sched-link-button" disabled={busy} onClick={() => apply(null)}>
              Reset to default
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
