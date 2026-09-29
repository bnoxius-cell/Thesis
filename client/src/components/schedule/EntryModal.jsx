import { useState, useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import {
  WEEKDAYS, ENTRY_ICONS, ENTRY_COLORS, defaultIconFor, compressImage, toISODate,
} from "../../utils/scheduleUtils";

const blankForm = (kind, date) => ({
  title: "",
  kind,
  repeat: date ? "once" : "weekly",
  days: date ? [] : [1, 3],
  date: date || toISODate(new Date()),
  startDate: "",
  endDate: "",
  startTime: "09:00",
  endTime: "10:00",
  location: "",
  notes: "",
  color: "",
  icon: "",
  image: "",
  skipOnHoliday: kind === "class",
});

const formFromEntry = (entry) => ({
  ...blankForm(entry.kind),
  ...entry,
  repeat: entry.date ? "once" : "weekly",
  date: entry.date || toISODate(new Date()),
});

// Add or edit one schedule entry. `entry` set means editing, otherwise `kind` and an
// optional `date` (when opened from a day) seed a new one. `onSave` returns an error
// message string on failure, or nothing on success.
export default function EntryModal({ entry, kind = "class", date, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(() => (entry ? formFromEntry(entry) : blankForm(kind, date)));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pictureBusy, setPictureBusy] = useState(false);
  const fileRef = useRef(null);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setError("");
  };

  const toggleDay = (value) =>
    set({ days: form.days.includes(value) ? form.days.filter((d) => d !== value) : [...form.days, value] });

  const handlePicture = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPictureBusy(true);
    try {
      set({ image: await compressImage(file) });
    } catch (err) {
      setError(err.message);
    } finally {
      setPictureBusy(false);
    }
  };

  const handleKind = (nextKind) => {
    // Classes usually pause on holidays and activities usually don't, so follow the
    // kind until the user has made their own choice by editing.
    set({ kind: nextKind, skipOnHoliday: nextKind === "class" });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setError("Give it a title.");
    if (form.repeat === "weekly" && form.days.length === 0) return setError("Pick at least one day.");
    if (form.endTime <= form.startTime) return setError("The end time has to be after the start time.");

    const payload = {
      title: form.title.trim(),
      kind: form.kind,
      startTime: form.startTime,
      endTime: form.endTime,
      location: form.location,
      notes: form.notes,
      color: form.color,
      icon: form.icon,
      image: form.image,
      skipOnHoliday: form.skipOnHoliday,
      ...(form.repeat === "once"
        ? { date: form.date, days: [] }
        : { days: form.days, startDate: form.startDate, endDate: form.endDate }),
    };
    setSaving(true);
    const message = await onSave(payload);
    setSaving(false);
    if (message) setError(message);
  };

  const PreviewIcon = ENTRY_ICONS[form.icon] || ENTRY_ICONS[defaultIconFor(form.kind)];

  return (
    <div className="modal-overlay" onClick={saving ? undefined : onClose}>
      <form className="modal-content sched-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-header">
          <h2>{entry ? "Edit entry" : "Add to schedule"}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="form-grid">
          <div className="form-group full-span">
            <div className="sched-segment" role="group" aria-label="Type">
              <button type="button" className={form.kind === "class" ? "active" : ""} onClick={() => handleKind("class")}>
                Class
              </button>
              <button type="button" className={form.kind === "activity" ? "active" : ""} onClick={() => handleKind("activity")}>
                Activity
              </button>
            </div>
          </div>

          <div className="form-group full-span">
            <label htmlFor="entry-title">{form.kind === "class" ? "Subject *" : "Activity *"}</label>
            <input
              id="entry-title"
              type="text"
              value={form.title}
              maxLength={80}
              onChange={(e) => set({ title: e.target.value })}
              placeholder={form.kind === "class" ? "e.g., Data Structures" : "e.g., Gym, Org meeting, Study block"}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="entry-start">Starts</label>
            <input id="entry-start" type="time" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="entry-end">Ends</label>
            <input id="entry-end" type="time" value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} />
          </div>

          <div className="form-group full-span">
            <div className="sched-segment" role="group" aria-label="Repeats">
              <button type="button" className={form.repeat === "weekly" ? "active" : ""} onClick={() => set({ repeat: "weekly", days: form.days.length ? form.days : [1, 3] })}>
                Repeats weekly
              </button>
              <button type="button" className={form.repeat === "once" ? "active" : ""} onClick={() => set({ repeat: "once" })}>
                One day only
              </button>
            </div>
          </div>

          {form.repeat === "weekly" ? (
            <>
              <div className="form-group full-span">
                <span className="sched-field-label">Days</span>
                <div className="sched-day-picker">
                  {WEEKDAYS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      className={form.days.includes(d.value) ? "active" : ""}
                      aria-pressed={form.days.includes(d.value)}
                      onClick={() => toggleDay(d.value)}
                    >
                      {d.short}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="entry-from">From (optional)</label>
                <input id="entry-from" type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label htmlFor="entry-until">Until (optional)</label>
                <input id="entry-until" type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => set({ endDate: e.target.value })} />
              </div>
            </>
          ) : (
            <div className="form-group full-span">
              <label htmlFor="entry-date">Date</label>
              <input id="entry-date" type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />
            </div>
          )}

          <div className="form-group full-span">
            <label htmlFor="entry-location">Where (optional)</label>
            <input id="entry-location" type="text" value={form.location} maxLength={80} onChange={(e) => set({ location: e.target.value })} placeholder="Room, building, or online link" />
          </div>

          <div className="form-group full-span">
            <label htmlFor="entry-notes">Notes (optional)</label>
            <input id="entry-notes" type="text" value={form.notes} maxLength={300} onChange={(e) => set({ notes: e.target.value })} placeholder="Bring your laptop, quiz today, etc." />
          </div>

          <div className="form-group full-span">
            <span className="sched-field-label">Picture</span>
            <div className="sched-picture-row">
              <span className="sched-thumb sched-thumb-lg" style={form.color ? { "--entry-color": form.color } : undefined}>
                {form.image ? <img src={form.image} alt="" /> : <PreviewIcon size={26} aria-hidden="true" />}
              </span>
              <div className="sched-picture-actions">
                <button type="button" className="secondary-button small" onClick={() => fileRef.current?.click()} disabled={pictureBusy}>
                  <ImagePlus size={16} aria-hidden="true" /> {pictureBusy ? "Preparing..." : form.image ? "Change picture" : "Add a picture"}
                </button>
                {form.image && (
                  <button type="button" className="sched-link-button" onClick={() => set({ image: "" })}>
                    <X size={14} aria-hidden="true" /> Remove
                  </button>
                )}
                <span className="sched-hint">No picture? The icon below is used instead.</span>
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handlePicture} />
            </div>
          </div>

          {!form.image && (
            <div className="form-group full-span">
              <span className="sched-field-label">Icon</span>
              <div className="sched-icon-picker">
                {Object.keys(ENTRY_ICONS).map((key) => {
                  const Icon = ENTRY_ICONS[key];
                  const selected = (form.icon || defaultIconFor(form.kind)) === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={selected ? "active" : ""}
                      aria-label={key.replace(/-/g, " ")}
                      aria-pressed={selected}
                      onClick={() => set({ icon: key })}
                    >
                      <Icon size={18} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="form-group full-span">
            <span className="sched-field-label">Color</span>
            <div className="sched-color-picker">
              <button type="button" className={`sched-swatch sched-swatch-auto ${form.color === "" ? "active" : ""}`} onClick={() => set({ color: "" })} aria-label="Use theme color" aria-pressed={form.color === ""}>
                Auto
              </button>
              {ENTRY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`sched-swatch ${form.color === c ? "active" : ""}`}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                  aria-pressed={form.color === c}
                  onClick={() => set({ color: c })}
                />
              ))}
            </div>
          </div>

          <label className="sched-check full-span">
            <input type="checkbox" checked={form.skipOnHoliday} onChange={(e) => set({ skipOnHoliday: e.target.checked })} />
            <span>Skip this on holidays</span>
          </label>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="modal-actions sched-modal-actions">
          {onDelete && (
            <button type="button" className="remove-friend-btn" onClick={onDelete} disabled={saving}>
              Delete
            </button>
          )}
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Saving..." : entry ? "Save changes" : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}
