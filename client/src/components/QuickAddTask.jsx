import { useEffect, useId, useRef, useState } from "react";
import { toast } from "react-toastify";
import { CalendarDays, ChevronUp, CircleAlert, Plus, SlidersHorizontal } from "lucide-react";
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

const openKey = (userId) => `stresscare:quick-add-open:${userId}`;
const readOpen = (userId) => {
  try { return localStorage.getItem(openKey(userId)); } catch { return null; }
};
const writeOpen = (userId, open) => {
  try { localStorage.setItem(openKey(userId), open ? "1" : "0"); } catch { /* private mode */ }
};

// A title, when it's due and roughly how big it is: enough to put a task on the plan in seconds.
// Everything else (class, notes, difficulty) lives behind "More details", which opens the full dialog.
//
//   onAdded(task)           the saved task, to put in the page's list
//   onMoreDetails(draft)    open the full dialog with { title, dueDate, hours }
//   tour                    data-tour marker for the Guide
//   flat                    no card of its own, for use inside a card
//   focusOnMount            put the cursor in the title on mount (the page re-laid itself out after a first add)
//   collapsible             show a one-row "Add a task" button until the student opens it, and a hide button once open
//   defaultOpen             with collapsible: open unless the student has left it closed (remembered per account)
//   onOpenChange(open)      with collapsible: the open state on mount and whenever it changes
export default function QuickAddTask({
  onAdded, onMoreDetails, onOpenChange, tour, focusOnMount = false, flat = false, collapsible = false, defaultOpen = true,
}) {
  const { backendUrl, userData } = useAuth();
  const userId = userData?._id;
  const uid = useId();
  const titleRef = useRef(null);
  const toggleRef = useRef(null);
  const nextFocus = useRef(null); // "title" or "toggle", set by the student opening or hiding the form
  const [expanded, setExpanded] = useState(() => {
    const stored = readOpen(userId);
    return stored === null ? defaultOpen : stored === "1";
  });
  const [revealed, setRevealed] = useState(false); // the student just opened it: let the form ease in
  const open = !collapsible || expanded;
  const dateRef = useRef(null);
  const [title, setTitle] = useState("");
  const [dueKey, setDueKey] = useState("tomorrow");
  const [picked, setPicked] = useState(""); // YYYY-MM-DD from the date picker
  const [size, setSize] = useState("medium");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (focusOnMount && open) titleRef.current?.focus({ preventScroll: true });
  }, [focusOnMount, open]);

  useEffect(() => {
    if (collapsible) onOpenChange?.(open);
  }, [collapsible, open, onOpenChange]);

  // Move focus after the form or the row button has rendered.
  useEffect(() => {
    const target = nextFocus.current === "title" ? titleRef.current : toggleRef.current;
    if (nextFocus.current) target?.focus({ preventScroll: true });
    nextFocus.current = null;
  }, [open]);

  const toggle = (next) => {
    nextFocus.current = next ? "title" : "toggle";
    setExpanded(next);
    setRevealed(next);
    writeOpen(userId, next);
  };

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
      setError("Give the task a title first.");
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
  const formId = `${uid}-form`;

  if (!open) {
    return (
      <section className="quick-add is-collapsed" data-tour={tour} aria-label="Add a task">
        <button
          ref={toggleRef}
          type="button"
          className="tonal-button quick-add-row"
          aria-expanded="false"
          onClick={() => toggle(true)}
        >
          <Plus size={16} aria-hidden="true" />Add a task
        </button>
      </section>
    );
  }

  return (
    <section className={`quick-add ${flat ? "is-flat" : "panel"}`} data-tour={tour} aria-label="Add a task">
      <form id={formId} className={revealed ? "quick-add-form is-revealed" : undefined} onSubmit={submit} noValidate>
        <header className="quick-add-head">
          <div>
            <h2 className="quick-add-title">Add a task</h2>
            <p className="quick-add-lead">Quick setup: a title, when it's due and how long it takes.</p>
          </div>
          {collapsible && (
            <button type="button" className="icon-action" aria-label="Hide quick add" onClick={() => toggle(false)}>
              <ChevronUp size={18} aria-hidden="true" />
            </button>
          )}
        </header>

        <div className="quick-add-field">
          <label className="quick-add-label" htmlFor={`${uid}-title`}>Title</label>
          <input
            ref={titleRef}
            id={`${uid}-title`}
            className="quick-add-input"
            type="text"
            value={title}
            maxLength={TITLE_MAX}
            placeholder="e.g., Lab report 3"
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? errorId : undefined}
            enterKeyHint="done"
            autoComplete="off"
            onChange={(e) => { setTitle(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (collapsible && e.key === "Escape" && !title) toggle(false); }}
          />
        </div>

        {error && (
          <p className="field-error quick-add-error" id={errorId} role="alert">
            <CircleAlert size={16} aria-hidden="true" />{error}
          </p>
        )}

        <div className="quick-add-opts">
          <div className="quick-add-group" role="group" aria-labelledby={`${uid}-due`}>
            <span className="quick-add-label" id={`${uid}-due`}>Due</span>
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
                  <span className="quick-add-chip-text">
                    {dueKey === "pick" && picked ? shortDate(picked) : (
                      <>
                        <span className="quick-add-long">Pick a date</span>
                        <span className="quick-add-short" aria-hidden="true">Date</span>
                      </>
                    )}
                  </span>
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

          <div className="quick-add-group" role="group" aria-labelledby={`${uid}-size`}>
            <span className="quick-add-label" id={`${uid}-size`}>Size</span>
            <div className="segmented quick-add-size">
              {SIZES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`segmented-option${size === s.key ? " is-selected" : ""}`}
                  aria-pressed={size === s.key}
                  aria-label={`${s.label}, about ${s.hours} ${s.hours === 1 ? "hour" : "hours"}`}
                  title={`About ${s.hours} ${s.hours === 1 ? "hour" : "hours"}`}
                  onClick={() => setSize(s.key)}
                >
                  {s.label}<span className="quick-add-hours" aria-hidden="true"> {s.hours}h</span>
                </button>
              ))}
            </div>
          </div>

          <div className="quick-add-actions">
            <button type="submit" className="primary-button quick-add-submit" disabled={saving} aria-busy={saving}>
              {saving ? <BusySpinner /> : <Plus size={16} aria-hidden="true" />}
              Add task
            </button>
            {onMoreDetails && (
              <>
                <span className="quick-add-or" aria-hidden="true">or</span>
                <button type="button" className="tonal-button quick-add-more" onClick={moreDetails}>
                  <SlidersHorizontal size={16} aria-hidden="true" />More details
                </button>
              </>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}
