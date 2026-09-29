import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { AlertTriangle, Check, Pencil, X } from "lucide-react";
import { useAuth } from "../../pages/authentication/AuthContext";
import { WEEKDAYS, formatTime, formatLongDate } from "../../utils/scheduleUtils";
import { analyzeEntry } from "../../utils/scheduleConflicts";

const dayLabel = (entry) =>
  entry.date
    ? formatLongDate(entry.date)
    : WEEKDAYS.filter((d) => entry.days.includes(d.value)).map((d) => d.short).join(", ");

const when = (entry) => `${dayLabel(entry)}, ${formatTime(entry.startTime)} to ${formatTime(entry.endTime)}`;

// Lets someone add a schedule that was shared with them (by code, or from a group chat) to
// their own. It shows what's inside, points out what clashes with the week they already
// have, and lets them skip or retime entries before anything is added.
//
//   source     { shareCode } or { groupId, messageId }
//   onImported called with the schedule the entries landed in
export default function ScheduleImportDialog({ source, onClose, onImported }) {
  const { backendUrl } = useAuth();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [include, setInclude] = useState({}); // entry _id -> boolean
  const [edits, setEdits] = useState({}); // entry _id -> { startTime, endTime, days, date }
  const [editing, setEditing] = useState(null);
  const [target, setTarget] = useState("new");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");

  const sourceKey = JSON.stringify(source);
  useEffect(() => {
    let cancelled = false;
    axios.post(`${backendUrl}/api/schedules/preview`, JSON.parse(sourceKey), { withCredentials: true })
      .then(({ data }) => {
        if (cancelled) return;
        if (!data.success) return setError(data.message || "Couldn't open that schedule.");
        setPreview(data);
        setTitle(data.source.title);
        // Classes the person already has would only be doubled, so those start unticked.
        const start = {};
        data.entries.forEach((entry) => {
          start[entry._id] = !analyzeEntry(entry, data.existing).duplicate;
        });
        setInclude(start);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || "Couldn't open that schedule. Check your connection and try again.");
      });
    return () => { cancelled = true; };
  }, [backendUrl, sourceKey]);

  // Each entry as it will be added (with edits applied) and how it lines up with what's there.
  const rows = useMemo(() => {
    if (!preview) return [];
    return preview.entries.map((original) => {
      const entry = { ...original, ...edits[original._id] };
      return { original, entry, ...analyzeEntry(entry, preview.existing) };
    });
  }, [preview, edits]);

  const chosen = rows.filter((r) => include[r.original._id]);
  const clashing = rows.filter((r) => r.conflicts.length > 0);
  const clashingChosen = chosen.filter((r) => r.conflicts.length > 0);

  const toggle = (id) => setInclude((s) => ({ ...s, [id]: !s[id] }));
  const skipClashing = () => setInclude((s) => {
    const next = { ...s };
    clashing.forEach((r) => { next[r.original._id] = false; });
    return next;
  });
  const patchEdit = (id, patch) => setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));

  const submit = async () => {
    setBusy(true);
    setSaveError("");
    try {
      const selections = chosen.map(({ original }) => ({
        id: original._id,
        ...(edits[original._id] && { edits: edits[original._id] }),
      }));
      const { data } = await axios.post(`${backendUrl}/api/schedules/import`, {
        ...source,
        selections,
        ...(target === "new" ? { title } : { targetScheduleId: target }),
      }, { withCredentials: true });
      if (data.success) {
        toast.success(`Added ${data.added} ${data.added === 1 ? "entry" : "entries"} to "${data.schedule.title}".`);
        onImported(data.schedule);
      } else {
        setSaveError(data.message || "Couldn't add those.");
      }
    } catch (err) {
      setSaveError(err.response?.data?.message || "Couldn't add those. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal-content sched-modal imp" role="dialog" aria-modal="true" aria-labelledby="imp-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="imp-title">{preview ? `Add "${preview.source.title}"` : "Add a schedule"}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {error && (
          <>
            <p className="form-error" role="alert">{error}</p>
            <div className="modal-actions sched-modal-actions">
              <button type="button" className="primary-button" onClick={onClose}>Close</button>
            </div>
          </>
        )}

        {!error && !preview && <p className="sched-hint">Opening the schedule...</p>}

        {preview && (
          <>
            <p className="imp-lead">
              {preview.source.ownerName ? `${preview.source.ownerName}'s` : "A shared"} schedule has {preview.entries.length}{" "}
              {preview.entries.length === 1 ? "entry" : "entries"}. Pick the ones you want. Your copy is yours to edit, and changing it never touches theirs.
            </p>
            {preview.source.alreadyAdded && (
              <p className="sched-notice">You've already added this schedule once. Adding it again makes more entries.</p>
            )}

            {clashing.length > 0 && (
              <div className="imp-clash-bar" role="status">
                <AlertTriangle size={18} aria-hidden="true" />
                <span>
                  {clashing.length} {clashing.length === 1 ? "entry clashes" : "entries clash"} with your own schedule.
                  Skip them, or edit the time and the warning updates.
                </span>
                <button type="button" className="secondary-button small" onClick={skipClashing}>Skip clashing</button>
              </div>
            )}

            <ul className="imp-list">
              {rows.map(({ original, entry, duplicate, conflicts }) => {
                const id = original._id;
                const isOpen = editing === id;
                return (
                  <li key={id} className={`imp-row ${conflicts.length ? "has-clash" : ""} ${include[id] ? "" : "is-off"}`}>
                    <label className="imp-pick">
                      <input type="checkbox" checked={Boolean(include[id])} onChange={() => toggle(id)} />
                      <span className="imp-main">
                        <strong>{entry.title}</strong>
                        <span className="imp-when">{when(entry)}</span>
                        {entry.location && <span className="imp-when">{entry.location}</span>}
                      </span>
                    </label>
                    <button type="button" className="sched-icon-button" onClick={() => setEditing(isOpen ? null : id)} aria-label={`Edit ${entry.title} before adding`} aria-expanded={isOpen}>
                      {isOpen ? <X size={15} aria-hidden="true" /> : <Pencil size={15} aria-hidden="true" />}
                    </button>

                    {duplicate && (
                      <p className="imp-status is-same"><Check size={14} aria-hidden="true" /> You already have this in "{duplicate.scheduleTitle}".</p>
                    )}
                    {conflicts.map((c) => (
                      <p className="imp-status is-clash" key={`${c.scheduleId}-${c.entry._id}`}>
                        <AlertTriangle size={14} aria-hidden="true" />
                        Overlaps {c.entry.title} ({when(c.entry)}) in "{c.scheduleTitle}".
                      </p>
                    ))}

                    {isOpen && (
                      <div className="imp-edit">
                        <label>
                          Starts
                          <input type="time" value={entry.startTime} onChange={(e) => patchEdit(id, { startTime: e.target.value })} />
                        </label>
                        <label>
                          Ends
                          <input type="time" value={entry.endTime} onChange={(e) => patchEdit(id, { endTime: e.target.value })} />
                        </label>
                        {entry.date ? (
                          <label>
                            Date
                            <input type="date" value={entry.date} onChange={(e) => e.target.value && patchEdit(id, { date: e.target.value })} />
                          </label>
                        ) : (
                          <div className="imp-days" role="group" aria-label="Days">
                            {WEEKDAYS.map((d) => (
                              <button
                                key={d.value}
                                type="button"
                                className={entry.days.includes(d.value) ? "active" : ""}
                                aria-pressed={entry.days.includes(d.value)}
                                onClick={() => {
                                  const days = entry.days.includes(d.value) ? entry.days.filter((x) => x !== d.value) : [...entry.days, d.value];
                                  if (days.length) patchEdit(id, { days });
                                }}
                              >
                                {d.short}
                              </button>
                            ))}
                          </div>
                        )}
                        {entry.endTime <= entry.startTime && (
                          <p className="form-error" role="alert">The end time has to be after the start time.</p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="imp-target">
              <label>
                Add to
                <select value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="new">A new schedule</option>
                  {preview.schedules.map((s) => <option key={s._id} value={s._id}>{s.title}</option>)}
                </select>
              </label>
              {target === "new" && (
                <label>
                  Name
                  <input type="text" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
                </label>
              )}
            </div>

            {clashingChosen.length > 0 && (
              <p className="sched-hint imp-warn"><AlertTriangle size={14} aria-hidden="true" /> {clashingChosen.length} of the entries you picked overlap. You can still add them and fix the times later.</p>
            )}
            {saveError && <p className="form-error" role="alert">{saveError}</p>}

            <div className="modal-actions sched-modal-actions">
              <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button>
              <button
                type="button"
                className="primary-button"
                onClick={submit}
                disabled={busy || chosen.length === 0 || chosen.some((r) => r.entry.endTime <= r.entry.startTime) || (target === "new" && !title.trim())}
              >
                {busy ? "Adding..." : chosen.length === 0 ? "Pick something to add" : `Add ${chosen.length} ${chosen.length === 1 ? "entry" : "entries"}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
