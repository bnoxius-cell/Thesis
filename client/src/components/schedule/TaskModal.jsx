import { useState } from "react";
import { Minus, Plus, Ticket, CircleCheck, RotateCcw } from "lucide-react";
import { toISODate, addDays, taskDueIso } from "../../utils/scheduleUtils";
import Modal from "../Modal";

const DIFFICULTY = ["Very easy", "Easy", "Medium", "Hard", "Very hard"];
const IMPORTANCE = ["Low", "Minor", "Normal", "Important", "Critical"];
const MIN_HOURS = 0.5;
const MAX_HOURS = 20;

const blankForm = (date) => ({
  title: "",
  course: "",
  description: "",
  dueDate: date || toISODate(addDays(new Date(), 1)),
  hours: 3,
  difficulty: 3,
  importance: 3,
});

const formFromTask = (task) => ({
  title: task.title,
  course: task.course,
  description: task.description || "",
  dueDate: taskDueIso(task.dueDate),
  hours: task.hours,
  difficulty: task.difficulty,
  importance: task.importance,
});

// Five steps, picked with one tap, with the word for the chosen step next to the label.
function Scale({ id, label, words, value, onChange }) {
  return (
    <div className="form-group full-span">
      <span className="sched-field-label" id={id}>
        {label} <em className="task-scale-word">{words[value - 1]}</em>
      </span>
      <div className="task-scale" role="radiogroup" aria-labelledby={id}>
        {words.map((word, i) => (
          <button
            key={word}
            type="button"
            role="radio"
            aria-checked={value === i + 1}
            aria-label={`${i + 1}, ${word}`}
            className={value >= i + 1 ? "is-on" : ""}
            onClick={() => onChange(i + 1)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

// Add or edit a task from the schedule page. It sits inside the schedule's theme scope, so it
// takes the same colors and shapes as the class form.
//
//   task         set when editing
//   date         due date to start with when adding from a day (YYYY-MM-DD)
//   courses      class names from the schedule, offered as suggestions
//   onSave       (payload) => error message, or nothing on success
//   onDelete, onToggleDone   editing only
//   onUseCode    (tag) => open the task-code preview instead
export default function TaskModal({ task, date, courses = [], onSave, onDelete, onToggleDone, onUseCode, onClose }) {
  const [form, setForm] = useState(() => (task ? formFromTask(task) : blankForm(date)));
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setError("");
  };

  const today = new Date();
  const quickDates = [
    { label: "Today", iso: toISODate(today) },
    { label: "Tomorrow", iso: toISODate(addDays(today, 1)) },
    { label: "In 3 days", iso: toISODate(addDays(today, 3)) },
    { label: "Next week", iso: toISODate(addDays(today, 7)) },
  ];

  const stepHours = (delta) => {
    const next = Math.min(MAX_HOURS, Math.max(MIN_HOURS, (Number(form.hours) || 0) + delta));
    set({ hours: Math.round(next * 2) / 2 });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setError("Give the task a name.");
    if (!form.course.trim()) return setError("Which class is it for?");
    if (!form.dueDate) return setError("Pick a due date.");
    const hours = Number(form.hours);
    if (!Number.isFinite(hours) || hours < MIN_HOURS || hours > MAX_HOURS) return setError(`Hours can be ${MIN_HOURS} to ${MAX_HOURS}.`);

    setSaving(true);
    const message = await onSave({
      title: form.title.trim(),
      course: form.course.trim(),
      description: form.description.trim(),
      dueDate: form.dueDate,
      hours,
      difficulty: form.difficulty,
      importance: form.importance,
    });
    setSaving(false);
    if (message) setError(message);
  };

  const useCode = () => {
    const tag = code.replace(/\D/g, "");
    if (!/^\d{6}$/.test(tag)) return setError("A task code has 6 digits.");
    onUseCode(tag);
  };

  const courseList = [...new Set(courses.filter(Boolean))].sort((a, b) => a.localeCompare(b));

  return (
    <Modal onClose={onClose} busy={saving} as="form" className="sched-modal task-modal" labelledBy="task-modal-title" onSubmit={submit}>
        <div className="modal-header">
          <div>
            <span className="panel-kicker">Task</span>
            <h2 id="task-modal-title">{task ? "Edit task" : "Add a task"}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {task?.isCompleted && <p className="sched-notice">This one is marked done. It stays off your plan until you reopen it.</p>}

        <div className="form-grid">
          <div className="form-group full-span">
            <label htmlFor="task-title">What needs doing?</label>
            <input
              id="task-title"
              className="task-title-input"
              type="text"
              value={form.title}
              maxLength={120}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="e.g., Capstone progress report"
              autoFocus
            />
          </div>

          <div className="form-group full-span">
            <label htmlFor="task-course">Class</label>
            <input
              id="task-course"
              type="text"
              value={form.course}
              maxLength={80}
              list="task-course-options"
              onChange={(e) => set({ course: e.target.value })}
              placeholder="e.g., Research Methods"
              autoComplete="off"
            />
            <datalist id="task-course-options">
              {courseList.map((c) => <option key={c} value={c} />)}
            </datalist>
            {courseList.length > 0 && (
              <div className="task-chips" aria-label="Classes in this schedule">
                {courseList.slice(0, 8).map((c) => (
                  <button key={c} type="button" className={form.course === c ? "is-on" : ""} onClick={() => set({ course: c })}>{c}</button>
                ))}
              </div>
            )}
          </div>

          <div className="form-group full-span">
            <label htmlFor="task-due">Due</label>
            <div className="task-due-row">
              <input id="task-due" type="date" value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
              <div className="task-chips">
                {quickDates.map((q) => (
                  <button key={q.label} type="button" className={form.dueDate === q.iso ? "is-on" : ""} onClick={() => set({ dueDate: q.iso })}>{q.label}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-group full-span">
            <span className="sched-field-label" id="task-hours-label">How long will it take?</span>
            <div className="task-stepper" role="group" aria-labelledby="task-hours-label">
              <button type="button" className="sched-icon-button" onClick={() => stepHours(-0.5)} disabled={Number(form.hours) <= MIN_HOURS} aria-label="Half an hour less">
                <Minus size={16} aria-hidden="true" />
              </button>
              <label className="task-stepper-value">
                <input
                  type="number"
                  min={MIN_HOURS}
                  max={MAX_HOURS}
                  step="0.5"
                  value={form.hours}
                  onChange={(e) => set({ hours: e.target.value })}
                  aria-label="Hours"
                />
                <span>hours</span>
              </label>
              <button type="button" className="sched-icon-button" onClick={() => stepHours(0.5)} disabled={Number(form.hours) >= MAX_HOURS} aria-label="Half an hour more">
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <Scale id="task-difficulty" label="How hard is it?" words={DIFFICULTY} value={form.difficulty} onChange={(difficulty) => set({ difficulty })} />
          <Scale id="task-importance" label="How much does it matter?" words={IMPORTANCE} value={form.importance} onChange={(importance) => set({ importance })} />

          <div className="form-group full-span">
            <label htmlFor="task-notes">Notes (optional)</label>
            <textarea
              id="task-notes"
              rows={3}
              value={form.description}
              maxLength={1000}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="Instructions, links, what's left to do"
            />
          </div>

          {!task && onUseCode && (
            <div className="form-group full-span task-code">
              <label htmlFor="task-code"><Ticket size={15} aria-hidden="true" /> Got a task code from a classmate?</label>
              <div className="task-code-row">
                <input
                  id="task-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                  placeholder="6 digits"
                  autoComplete="off"
                />
                <button type="button" className="secondary-button" onClick={useCode} disabled={code.length !== 6}>Use code</button>
              </div>
            </div>
          )}
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="modal-actions sched-modal-actions">
          {onDelete && (
            <button type="button" className="remove-friend-btn" onClick={onDelete} disabled={saving}>Delete</button>
          )}
          {onToggleDone && (
            <button type="button" className="secondary-button" onClick={onToggleDone} disabled={saving}>
              {task.isCompleted ? <><RotateCcw size={16} aria-hidden="true" /> Reopen</> : <><CircleCheck size={16} aria-hidden="true" /> Mark done</>}
            </button>
          )}
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Saving..." : task ? "Save changes" : "Add task"}
          </button>
        </div>
    </Modal>
  );
}
