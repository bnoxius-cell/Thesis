import { taskDueIso, toISODate } from "@/utils/scheduleUtils";

// The task form, new and edit. The limit matches TASK_LIMITS on the server, which checks it again. Sizes map
// to hours the same way effortLabel reads them back (up to 1.5 is Small, up to 4 Medium).
export const TASK_TITLE_MAX = 120;
export const TASK_NOTES_MAX = 1000;

export const TASK_SIZES = [
  { value: 1, label: "Small" },
  { value: 3, label: "Medium" },
  { value: 5, label: "Large" },
];

export const NO_SUBJECT = "";

export const emptyTaskForm = (today = new Date()) => ({
  title: "",
  subject: NO_SUBJECT,
  dueDate: toISODate(today),
  hours: 3,
  description: "",
});

// The size the Segment shows for stored hours (an imported task may have 2): the same bands as
// effortLabel. The hours themselves are only replaced when the student picks a size.
export const sizeOf = (hours) => (hours <= 1.5 ? 1 : hours <= 4 ? 3 : 5);

// The form for an existing task. `subjectId` is the subject the task resolves to (by id, else by its
// course label) or NO_SUBJECT. Hours stay as stored.
export const taskFormFrom = (task, subjectId = NO_SUBJECT) => ({
  title: task.title,
  subject: subjectId,
  dueDate: taskDueIso(task.dueDate),
  hours: Number(task.hours) || 3,
  description: task.description || "",
});

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

export const taskPayload = (form) => ({
  title: clean(form.title),
  subject: form.subject || null,
  dueDate: form.dueDate,
  hours: form.hours,
  description: form.description.trim(),
});

// Only what the student changed, as the body of a PUT, so an imported task's 2 hours or its course
// label aren't rewritten by accident. A subject change sends `subject`, never `course`; "No subject"
// also clears the old course label (`course: ""`) so what shows is what was set.
export function taskChanges(start, form) {
  const changes = {};
  if (clean(form.title) !== clean(start.title)) changes.title = clean(form.title);
  if (form.subject !== start.subject) {
    if (form.subject) changes.subject = form.subject;
    else Object.assign(changes, { subject: null, course: "" });
  }
  if (form.dueDate !== start.dueDate) changes.dueDate = form.dueDate;
  if (form.hours !== start.hours) changes.hours = form.hours;
  if (form.description.trim() !== start.description.trim()) changes.description = form.description.trim();
  return changes;
}

// Plain messages for what is missing, keyed by field. Empty when the form can be sent.
export function taskErrors(form) {
  const errors = {};
  if (!clean(form.title)) errors.title = "Give the task a name.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dueDate)) errors.dueDate = "Pick a due date.";
  return errors;
}

// Whether closing a new task's form should ask first.
export const taskStarted = (form) => Boolean(clean(form.title) || form.description.trim());
