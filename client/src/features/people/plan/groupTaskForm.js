import { fromISODate, taskDueIso } from "@/utils/scheduleUtils";
import { clean } from "@/features/tasks/taskForm";

// The group task form (Figma GW-3), new and edit. Limits are the personal task's (TASK_TITLE_MAX and
// TASK_NOTES_MAX in tasks/taskForm.js); the server checks them again. A group task has no subject, so the
// course is plain text, and the size is the hours, difficulty and importance the server stores.
export const COURSE_MAX = 80;

const hoursLabel = (hours) => (hours < 1 ? `${Math.round(hours * 60)} minutes` : hours === 1 ? "1 hour" : `${hours} hours`);

const HOUR_OPTIONS = [0.5, 1, 2, 3, 4, 6, 8].map((value) => ({ value, label: hoursLabel(value) }));
const DIFFICULTY_OPTIONS = ["Very easy", "Easy", "Medium", "Hard", "Very hard"].map((label, i) => ({ value: i + 1, label }));
const IMPORTANCE_OPTIONS = ["Very low", "Low", "Medium", "High", "Very high"].map((label, i) => ({ value: i + 1, label }));

// What each editable field is called in a sentence, and how to say its value.
const FIELDS = {
  title: { noun: "title", norm: clean, say: (value) => `"${clean(value)}"` },
  course: { noun: "course", norm: clean, say: (value) => (clean(value) ? `"${clean(value)}"` : "empty") },
  dueDate: { noun: "due date", say: (value) => fromISODate(value).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) },
  hours: { noun: "time needed", say: hoursLabel },
  difficulty: { noun: "difficulty", say: (value) => DIFFICULTY_OPTIONS[value - 1]?.label ?? String(value) },
  importance: { noun: "importance", say: (value) => IMPORTANCE_OPTIONS[value - 1]?.label ?? String(value) },
  description: {
    noun: "notes",
    norm: (value) => value.trim(),
    say: (value) => (value.trim() ? `"${value.trim().slice(0, 40)}${value.trim().length > 40 ? "..." : ""}"` : "empty"),
  },
};
const KEYS = Object.keys(FIELDS);

// The three pickers, in the order the form shows them. `optionsFor(value)` is the usual list plus the value
// a task came in with when the list doesn't have it (hours of 2.5, say), so a picker never shows an empty choice.
const picker = (key, label, options) => ({
  key,
  label,
  optionsFor: (value) =>
    value == null || options.some((option) => option.value === value)
      ? options
      : [...options, { value, label: FIELDS[key].say(value) }].sort((a, b) => a.value - b.value),
});
export const PICKERS = [
  picker("hours", "Time needed", HOUR_OPTIONS),
  picker("difficulty", "Difficulty", DIFFICULTY_OPTIONS),
  picker("importance", "Importance", IMPORTANCE_OPTIONS),
];
const norm = (key, value) => (FIELDS[key].norm ? FIELDS[key].norm(value) : value);

// hours, difficulty and importance start empty on a new task ("Pick one"): the server then uses its usual middle value.
export const emptyGroupTaskForm = () => ({
  title: "",
  course: "",
  dueDate: "",
  hours: null,
  difficulty: null,
  importance: null,
  description: "",
});

export const groupTaskFormFrom = (task) => ({
  title: task.title ?? "",
  course: task.course ?? "",
  dueDate: taskDueIso(task.dueDate),
  hours: task.hours ?? null,
  difficulty: task.difficulty ?? null,
  importance: task.importance ?? null,
  description: task.description ?? "",
});

// The body of a new task.
export const groupTaskPayload = (form) => ({
  title: clean(form.title),
  course: clean(form.course),
  dueDate: form.dueDate,
  description: form.description.trim(),
  ...Object.fromEntries(["hours", "difficulty", "importance"].filter((key) => form[key] != null).map((key) => [key, form[key]])),
});

// Plain messages for what is missing, keyed by field. Empty when the form can be sent.
export function groupTaskErrors(form) {
  const errors = {};
  if (!clean(form.title)) errors.title = "Give the task a name.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dueDate)) errors.dueDate = "Pick a due date.";
  return errors;
}

export const taskStarted = (form) => Boolean(clean(form.title) || form.description.trim());

// The fields the student changed from `start` (the form the task opened as).
export const changedFields = (start, form) => KEYS.filter((key) => norm(key, form[key]) !== norm(key, start[key]));

// The body of a PATCH: the new value of each changed field and, for the same keys, the value the task
// had on the server when the form opened (`base`, the task as the server sent it). null when nothing changed.
export function groupTaskEdit(base, start, form) {
  const keys = changedFields(start, form);
  if (keys.length === 0) return null;
  const was = { ...base, course: base.course ?? "", description: base.description ?? "" };
  return {
    changes: Object.fromEntries(keys.map((key) => [key, norm(key, form[key])])),
    expected: Object.fromEntries(keys.map((key) => [key, was[key]])),
  };
}

// After a conflict: what the form and its start become so the student can check and save again. Fields
// someone else changed take their value, and so does every field the student left alone; the rest of the
// student's own edits stay. `latest` is the task as it is on the server now.
export function rebaseForm({ form, start }, latest, conflicts) {
  const now = groupTaskFormFrom(latest);
  const mine = changedFields(start, form).filter((key) => !conflicts.includes(key));
  return {
    start: now,
    form: Object.fromEntries(KEYS.map((key) => [key, mine.includes(key) ? form[key] : now[key]])),
  };
}

const listOf = (words) => (words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : words[0]);

// The words for a conflict: one line for the top of the dialog, and a note per field saying what it was
// when the student opened the task. `was` is the form the task opened as, `by` who changed it.
export function conflictText(conflicts, was, by) {
  const keys = conflicts.filter((key) => key in FIELDS);
  return {
    summary: `${by} changed the ${listOf(keys.map((key) => FIELDS[key].noun))} while you were editing. Check it and save again.`,
    notes: Object.fromEntries(keys.map((key) => [key, `${by} set this. It was ${FIELDS[key].say(was[key])} when you opened the task.`])),
  };
}

// "Web Systems · 3 h · Due Thu, Nov 20": the line under a task's title.
export function taskMeta({ course, hours, dueDate }) {
  const due = fromISODate(taskDueIso(dueDate)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return [course, `${hours} h`, `Due ${due}`].filter(Boolean).join(" · ");
}
