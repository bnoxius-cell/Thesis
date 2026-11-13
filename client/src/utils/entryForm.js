import { analyzeEntry } from "./scheduleConflicts";
import { WEEKDAYS, formatTime, fromISODate, isWebLink, toISODate } from "./scheduleUtils";

// The class, exam, event and activity form (Plan, C4). Pure helpers, no React, so the server tests can run
// them. The limits and messages mirror cleanEntry in scheduleController.js, which checks everything again.
export const ENTRY_TITLE_MAX = 80;
export const ENTRY_ROOM_MAX = 80;
export const ENTRY_LINK_MAX = 300;
export const ENTRY_NOTES_MAX = 300;
export const PREP_HOURS_MAX = 40;
export const DEFAULT_PREP_HOURS = 4;

export const LINK_MESSAGE = "The meeting link has to be a full web address, like https://meet.google.com/abc-defg-hij.";

// How an entry repeats: "weekly" on chosen days, or "once" on one date.
export const REPEAT = { weekly: "weekly", once: "once" };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = (value) => DATE.test(value) && toISODate(fromISODate(value)) === value;

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

// A new form for one kind. Exams are always one day; an event starts as one day; classes and activities
// repeat weekly. `subject` is the subject's name when the picker chose one (it fills the title).
export const emptyEntryForm = (kind = "class", today = new Date()) => ({
  kind,
  subject: "",
  title: "",
  repeat: kind === "class" || kind === "activity" ? REPEAT.weekly : REPEAT.once,
  days: [],
  date: toISODate(today),
  startTime: "09:00",
  endTime: "10:00",
  location: "",
  meetingUrl: "",
  notes: "",
  prepHours: DEFAULT_PREP_HOURS,
});

// The form for a stored entry (editing). The kind stays what it was.
export const entryFormFrom = (entry) => ({
  kind: entry.kind,
  subject: "",
  title: entry.title,
  repeat: entry.date ? REPEAT.once : REPEAT.weekly,
  days: [...(entry.days ?? [])],
  date: entry.date || toISODate(new Date()),
  startTime: entry.startTime,
  endTime: entry.endTime,
  location: entry.location || "",
  meetingUrl: entry.meetingUrl || "",
  notes: entry.notes || "",
  prepHours: entry.kind === "exam" ? entry.prepHours ?? DEFAULT_PREP_HOURS : DEFAULT_PREP_HOURS,
});

// The body of a POST or PUT. `stored` is the entry as the server has it: an edit replaces the whole entry,
// so what the form doesn't show (color, icon, image, skipOnHoliday, startDate and endDate) is carried over
// from it. `_id` never goes back. A weekly entry sends `date: ""` and a one-day entry sends `days: []`, so
// switching between them leaves nothing behind. startDate and endDate only belong to weekly entries.
export function entryPayload(form, stored = {}) {
  const { _id, ...kept } = stored;
  const once = form.repeat === REPEAT.once || form.kind === "exam";
  const payload = {
    ...kept,
    kind: form.kind,
    title: clean(form.title),
    startTime: form.startTime,
    endTime: form.endTime,
    location: clean(form.location),
    meetingUrl: form.meetingUrl.trim(),
    notes: form.notes.trim(),
    date: once ? form.date : "",
    days: once ? [] : [...form.days].sort((a, b) => a - b),
  };
  if (once) Object.assign(payload, { startDate: "", endDate: "" });
  if (form.kind === "exam") payload.prepHours = Number(form.prepHours);
  else delete payload.prepHours;
  return payload;
}

// One message for the meeting link, empty when it is fine or blank. Used on blur and on save.
export function linkError(value) {
  const link = value.trim();
  if (!link) return "";
  if (link.length > ENTRY_LINK_MAX) return "That meeting link is too long.";
  return isWebLink(link) ? "" : LINK_MESSAGE;
}

// Plain messages for what is wrong, keyed by field. Empty when the form can be sent.
export function entryErrors(form) {
  const errors = {};
  const title = clean(form.title);
  if (!title) errors.title = "A title is required.";
  else if (title.length > ENTRY_TITLE_MAX) errors.title = `The title is too long (${ENTRY_TITLE_MAX} characters max).`;

  const once = form.repeat === REPEAT.once || form.kind === "exam";
  if (once) {
    if (!form.date) errors.date = form.kind === "exam" ? "An exam needs a date." : "Pick a date.";
    else if (!isRealDate(form.date)) errors.date = "That date is not valid.";
  } else if (form.days.length === 0) {
    errors.days = "Pick at least one day.";
  }

  if (!TIME.test(form.startTime) || !TIME.test(form.endTime)) errors.times = "Start and end times are required.";
  else if (form.endTime <= form.startTime) errors.times = "The end time must be after the start time.";

  const link = linkError(form.meetingUrl);
  if (link) errors.meetingUrl = link;

  if (form.kind === "exam") {
    const hours = Number(form.prepHours);
    if (form.prepHours === "" || !Number.isFinite(hours) || hours < 0 || hours > PREP_HOURS_MAX) {
      errors.prepHours = `Study hours for an exam can be 0 to ${PREP_HOURS_MAX}.`;
    }
  }
  return errors;
}

// Whether closing the form should ask first: anything typed, picked or changed from the empty form.
export const entryStarted = (form, start) =>
  JSON.stringify({ ...form, subject: "" }) !== JSON.stringify({ ...start, subject: "" });

// The title a subject pick fills in: the subject's name, but only while the title is empty or still the
// name the previous pick put there, so a title the student typed is never overwritten.
export const titleAfterSubject = (title, previousName, name) =>
  !clean(title) || clean(title) === previousName ? name : title;

const SHORT_DAY = Object.fromEntries(WEEKDAYS.map((day) => [day.value, day.short]));

// "Overlaps Web Systems, Tue 1:00 pm." when the form clashes with an entry already on the timetable, or
// "Web Systems, Tue 1:00 pm is the same." for a copy; "" when there is nothing to say or the form isn't
// complete enough to compare. `existing` is the timetable's entries. A warning only, it never blocks.
export function clashNote(form, existing) {
  if (!existing?.length || !TIME.test(form.startTime) || !TIME.test(form.endTime) || form.endTime <= form.startTime) return "";
  const once = form.repeat === REPEAT.once || form.kind === "exam";
  if (once ? !isRealDate(form.date) : form.days.length === 0) return "";
  const { duplicate, conflicts } = analyzeEntry(entryPayload(form),existing.map((entry) => ({ entry })));
  const found = duplicate ?? conflicts[0]?.entry;
  if (!found) return "";
  const day = found.date
    ? fromISODate(found.date).getDay()
    : once
      ? fromISODate(form.date).getDay()
      : form.days.find((value) => found.days.includes(value));
  const time = formatTime(found.startTime).replace(/ (AM|PM)$/, (m) => m.toLowerCase());
  const where = `${found.title}, ${SHORT_DAY[day]} ${time}`;
  return duplicate ? `${where} looks the same. You can still add it.` : `Overlaps ${where}. You can still add it.`;
}
