import { toISODate } from "@/utils/scheduleUtils";

// The New task form. The limit matches TASK_LIMITS on the server, which checks it again. Sizes map
// to hours the same way effortLabel reads them back (up to 1.5 is Small, up to 4 Medium).
export const TASK_TITLE_MAX = 120;

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
});

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

export const taskPayload = (form) => ({
  title: clean(form.title),
  subject: form.subject || null,
  dueDate: form.dueDate,
  hours: form.hours,
});

// Plain messages for what is missing, keyed by field. Empty when the form can be sent.
export function taskErrors(form) {
  const errors = {};
  if (!clean(form.title)) errors.title = "Give the task a name.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dueDate)) errors.dueDate = "Pick a due date.";
  return errors;
}

export const taskStarted = (form) => Boolean(clean(form.title));
