import { useEffect, useId, useRef, useState } from "react";
import { toast } from "react-toastify";
import { CalendarDays, CircleAlert, Plus, SlidersHorizontal } from "lucide-react";
import { useAuth } from "../pages/authentication/AuthContext";
import { addDays, fromISODate, toISODate } from "../utils/scheduleUtils";
import { saveTaskRequest } from "../utils/taskApi";
import BusySpinner from "./BusySpinner";

const TITLE_MAX = 120;
const SIZES = [
  { key: "short", label: "Short", hours: 1 },
  { key: "medium", label: "Medium", hours: 2 },
  { key: "long", label: "Long", hours: 4 },
];

// Today, Tomorrow and "This week" (this Friday, or Sunday once Friday has come). A chip whose date is
// the same as an earlier one is dropped, so Thursday has no "This week" next to "Tomorrow".
function dueOptions(now = new Date()) {
  const day = now.getDay(); // 0 is Sunday
  const toEnd = day >= 1 && day <= 4 ? 5 - day : (7 - day) % 7;
  const options = [
    { key: "today", label: "Today", iso: toISODate(now) },
    { key: "tomorrow", label: "Tomorrow", iso: toISODate(addDays(now, 1)) },
    { key: "week", label: "This week", iso: toISODate(addDays(now, toEnd)) },
  ];
  return options.filter((o, i) => options.findIndex((p) => p.iso === o.iso) === i);
}

// Browsers that can open the native date picker from a button get a tidy chip; the rest get a plain date field.
const CAN_SHOW_PICKER = typeof HTMLInputElement !== "undefined" && "showPicker" in HTMLInputElement.prototype;

const shortDate = (iso) => fromISODate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// A title, when it's due and roughly how big it is: enough to put a task on the plan in seconds.
// Everything else (class, notes, difficulty) lives behind "More details", which opens the full dialog.
//
//   onAdded(task)           the saved task, to put in the page's list
//   onMoreDetails(draft)    open the full dialog with { title, dueDate, hours }
//   tour                    data-tour marker for the Guide
//   flat                    no card of its own, for use inside a card
//   focusOnMount            put the cursor in the title on mount (the page re-laid itself out after a first add)
export default function QuickAddTask({ onAdded, onMoreDetails, tour, focusOnMount = false, flat = false }) {
  const { backendUrl } = useAuth();
  const uid = useId();
  const titleRef = useRef(null);
  const dateRef = useRef(null);
  const [title, setTitle] = useState("");
  const [dueKey, setDueKey] = useState("tomorrow");
  const [picked, setPicked] = useState(""); // YYYY-MM-DD from the date picker
  const [size, setSize] = useState("medium");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (focusOnMount) titleRef.current?.focus({ preventScroll: true });
  }, [focusOnMount]);

  const options = dueOptions();
  const dueIso = dueKey === "pick" ? picked : options.find((o) => o.key === dueKey)?.iso || options[0].iso;
  const hours = SIZES.find((s) => s.key === size).hours;

  const openPicker = () => {
    const input = dateRef.current;
    if (!input) return;
    if (!CAN_SHOW_PICKER) {
      setTimeout(() => input.focus(), 0);
      return;
    }
    try { input.showPicker(); } catch { input.focus(); }
  };

  const chooseDue = (key) => {
    setDueKey(key);
    setError("");
    if (key === "pick") openPicker();
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const clean = title.trim();
    if (!clean) {
      setError("Type what needs doing first.");
      titleRef.current?.focus();
      return;
    }
    if (!dueIso) {
      setError("Pick a due date.");
      openPicker();
      return;
    }
    setSaving(true);
    const { task, error: message } = await saveTaskRequest(backendUrl, { title: clean, dueDate: dueIso, hours });
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    setTitle("");
    setError("");
    toast.success("Added.");
    onAdded?.(task);
    // Ready for the next one: due date and size stay as they were.
    titleRef.current?.focus({ preventScroll: true });
  };

  const moreDetails = () => {
    onMoreDetails?.({ title: title.trim(), dueDate: dueIso || undefined, hours });
    setTitle("");
    setError("");
  };

  const errorId = `${uid}-error`;

  return (
    <section className={`quick-add ${flat ? "is-flat" : "panel"}`} data-tour={tour} aria-label="Add a task">
      <form onSubmit={submit} noValidate>
        <div className="quick-add-top">
          <input
            ref={titleRef}
            id={`${uid}-title`}
            className="quick-add-input"
            type="text"
            value={title}
            maxLength={TITLE_MAX}
            placeholder="What needs doing?"
            aria-label="What needs doing?"
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? errorId : undefined}
            enterKeyHint="done"
            autoComplete="off"
            onChange={(e) => { setTitle(e.target.value); setError(""); }}
          />
          <button type="submit" className="primary-button quick-add-submit" disabled={saving} aria-busy={saving}>
            {saving ? <BusySpinner /> : <Plus size={16} aria-hidden="true" />}
            Add
          </button>
        </div>

        {error && (
          <p className="field-error quick-add-error" id={errorId} role="alert">
            <CircleAlert size={16} aria-hidden="true" />{error}
          </p>
        )}

        <div className="quick-add-opts">
          <div className="quick-add-group" role="group" aria-label="Due">
            <span className="quick-add-label" aria-hidden="true">Due</span>
            <div className="quick-add-chips">
              {options.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  className={`quick-add-chip${dueKey === o.key ? " is-selected" : ""}`}
                  aria-pressed={dueKey === o.key}
                  onClick={() => chooseDue(o.key)}
                >
                  {o.label}
                </button>
              ))}
              <span className="quick-add-pick">
                <button
                  type="button"
                  className={`quick-add-chip is-pick${dueKey === "pick" ? " is-selected" : ""}${dueKey === "pick" && picked ? " has-date" : ""}`}
                  aria-pressed={dueKey === "pick"}
                  aria-label={dueKey === "pick" && picked ? `Due ${shortDate(picked)}, change the date` : "Pick a date"}
                  onClick={() => chooseDue("pick")}
                >
                  <CalendarDays size={16} aria-hidden="true" />
                  <span className="quick-add-chip-text">{dueKey === "pick" && picked ? shortDate(picked) : "Pick a date"}</span>
                </button>
                {/* Opened by the chip. Without showPicker() support it is shown as a normal date field. */}
                {(CAN_SHOW_PICKER || dueKey === "pick") && (
                  <input
                    ref={dateRef}
                    className={CAN_SHOW_PICKER ? "quick-add-date-hidden" : "quick-add-date"}
                    type="date"
                    value={picked}
                    tabIndex={CAN_SHOW_PICKER ? -1 : undefined}
                    aria-hidden={CAN_SHOW_PICKER ? "true" : undefined}
                    aria-label="Due date"
                    onChange={(e) => { setPicked(e.target.value); setDueKey("pick"); setError(""); }}
                  />
                )}
              </span>
            </div>
          </div>

          <div className="quick-add-group" role="group" aria-label="Size">
            <span className="quick-add-label" aria-hidden="true">Size</span>
            <div className="segmented quick-add-size">
              {SIZES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`segmented-option${size === s.key ? " is-selected" : ""}`}
                  aria-pressed={size === s.key}
                  aria-label={`${s.label}, about ${s.hours} ${s.hours === 1 ? "hour" : "hours"}`}
                  onClick={() => setSize(s.key)}
                >
                  {s.label} <span className="quick-add-hours">{s.hours}h</span>
                </button>
              ))}
            </div>
          </div>

          {onMoreDetails && (
            <button type="button" className="ghost-button quick-add-more" onClick={moreDetails}>
              <SlidersHorizontal size={16} aria-hidden="true" />More details
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
