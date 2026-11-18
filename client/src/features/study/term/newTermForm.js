import { analyzeEntry } from "../../../utils/scheduleConflicts.js";
import { WEEKDAYS, fromISODate } from "../../../utils/scheduleUtils.js";
import { lower } from "../../plan/entryTime.js";
import { SUBJECT_LIMITS } from "../subjectForm.js";

// The New term wizard's form (TR-2 to TR-4). Pure helpers, no React, so the server tests can run them. The limits
// and messages mirror utils/newTerm.js on the server, which checks everything again before it writes.
//
// The form is { archiveIds, term, firstDay, subjects: [{ key, name, code, classTimes: [{ key, days, startTime,
// endTime, location }] }] }. `key`s only identify rows while they are on screen. Days are Date#getDay numbers.
export const MAX_NEW_SUBJECTS = 12;
export const MAX_CLASS_TIMES = 6;
export const TERM_MAX = SUBJECT_LIMITS.term;

// Monday to Saturday, as drawn in the frames; a Sunday class is added in Plan afterwards.
export const TERM_DAYS = WEEKDAYS
  .filter((day) => day.value !== 0)
  .map((day) => ({ ...day, label: day.value === 4 ? "Th" : day.long[0] }));

const DEFAULT_START = "08:00";
const DEFAULT_END = "09:30";
const DAY_ORDER = Object.fromEntries(WEEKDAYS.map((day, index) => [day.value, index]));
const SHORT_DAY = Object.fromEntries(WEEKDAYS.map((day) => [day.value, day.short]));

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const inWeekOrder = (days) => [...days].sort((a, b) => DAY_ORDER[a] - DAY_ORDER[b]);

let rows = 0;
const nextKey = (kind) => `${kind}-${(rows += 1)}`;

// `fresh` marks a row the student just added, so it eases in (it never reaches the server).
export const emptyClassTime = (fresh = false) => ({ key: nextKey("time"), days: [], startTime: DEFAULT_START, endTime: DEFAULT_END, location: "", fresh });
export const emptyTermSubject = (fresh = false) => ({ key: nextKey("subject"), name: "", code: "", classTimes: [emptyClassTime()], fresh });

// Every active subject starts ticked (a student usually ends the whole term), with one empty subject to fill in.
export const emptyTermForm = (activeSubjects) => ({
  archiveIds: activeSubjects.map((subject) => subject._id),
  term: "",
  firstDay: "",
  subjects: [emptyTermSubject()],
});

// Whether closing should ask first: anything ticked, typed or picked differently from where it started.
export const termStarted = (form, start) => JSON.stringify(form) !== JSON.stringify(start);

// ---- Changes (each returns the next form) ----

export const setArchived = (form, ids) => ({ ...form, archiveIds: ids });
export const setTermField = (form, field, value) => ({ ...form, [field]: value });
const mapSubject = (form, key, change) => ({ ...form, subjects: form.subjects.map((s) => (s.key === key ? change(s) : s)) });
export const changeSubject = (form, key, fields) => mapSubject(form, key, (s) => ({ ...s, ...fields }));
export const addSubject = (form) => (form.subjects.length >= MAX_NEW_SUBJECTS ? form : { ...form, subjects: [...form.subjects, emptyTermSubject(true)] });
export const removeSubject = (form, key) => ({ ...form, subjects: form.subjects.filter((s) => s.key !== key) });
export const addClassTime = (form, key) =>
  mapSubject(form, key, (s) => (s.classTimes.length >= MAX_CLASS_TIMES ? s : { ...s, classTimes: [...s.classTimes, emptyClassTime(true)] }));
export const removeClassTime = (form, key, timeKey) =>
  mapSubject(form, key, (s) => ({ ...s, classTimes: s.classTimes.filter((t) => t.key !== timeKey) }));
export const changeClassTime = (form, key, timeKey, fields) =>
  mapSubject(form, key, (s) => ({ ...s, classTimes: s.classTimes.map((t) => (t.key === timeKey ? { ...t, ...fields } : t)) }));

// ---- What was typed ----

const isBlankTime = (time) => time.days.length === 0 && !clean(time.location) && time.startTime === DEFAULT_START && time.endTime === DEFAULT_END;
const isBlankSubject = (subject) => !clean(subject.name) && !clean(subject.code) && subject.classTimes.every(isBlankTime);

// The subjects the student filled in: an untouched row is ignored, so an empty form needs no deleting.
export const filledSubjects = (form) => form.subjects.filter((subject) => !isBlankSubject(subject));
const filledTimes = (subject) => subject.classTimes.filter((time) => !isBlankTime(time));

export const classTimeCount = (form) => filledSubjects(form).reduce((total, subject) => total + filledTimes(subject).length, 0);
export const nothingToApply = (form) => form.archiveIds.length === 0 && filledSubjects(form).length === 0;

const timeError = (time) => {
  if (time.days.length === 0) return "Pick at least one day.";
  if (!time.startTime || !time.endTime) return "Set a start and an end time.";
  if (time.endTime <= time.startTime) return "The end time must be after the start time.";
  return "";
};

// Plain messages for what is wrong, keyed by subject key and then `name` or `times[timeKey]`. Empty when the form
// can go to the review.
export function termErrors(form) {
  const errors = {};
  const seen = new Set();
  for (const subject of filledSubjects(form)) {
    const name = clean(subject.name);
    const found = { times: {} };
    if (!name) found.name = "Give the subject a name.";
    else if (name.length > SUBJECT_LIMITS.name) found.name = `The name can be up to ${SUBJECT_LIMITS.name} characters.`;
    else if (seen.has(name.toLowerCase())) found.name = "You listed this subject already.";
    seen.add(name.toLowerCase());
    for (const time of filledTimes(subject)) {
      const message = timeError(time);
      if (message) found.times[time.key] = message;
    }
    if (found.name || Object.keys(found.times).length > 0) errors[subject.key] = found;
  }
  return errors;
}

// The body of POST /api/subjects/new-term.
export function termRequest(form) {
  return {
    archive: form.archiveIds,
    term: clean(form.term) || undefined,
    firstDay: form.firstDay || undefined,
    subjects: filledSubjects(form).map((subject) => ({
      name: clean(subject.name),
      code: clean(subject.code),
      classTimes: filledTimes(subject).map((time) => ({
        days: inWeekOrder(time.days),
        startTime: time.startTime,
        endTime: time.endTime,
        location: clean(time.location),
      })),
    })),
  };
}

// ---- Clashes: a warning under the row, never a block ----

// The entries of the main timetable that are still there after the archive (the classes of the subjects being
// archived leave it; exams, events and the other subjects' classes stay).
export const keptEntries = (entries, archiveIds) =>
  (entries ?? []).filter((entry) => !(entry.kind === "class" && archiveIds.includes(entry.subject)));

const clashDay = (days, found) => (found.date ? fromISODate(found.date).getDay() : days.find((day) => found.days.includes(day)));

// { [timeKey]: message } for the class times that overlap one already in the timetable or typed above them,
// or that repeat one (the server adds those once). `kept` is `keptEntries(...)`.
export function clashNotes(form, kept) {
  const notes = {};
  const placed = [];
  for (const subject of filledSubjects(form)) {
    const title = clean(subject.name) || "this subject";
    for (const time of filledTimes(subject)) {
      if (timeError(time)) continue;
      const days = inWeekOrder(time.days);
      const entry = { title, days, date: "", startDate: form.firstDay, endDate: "", startTime: time.startTime, endTime: time.endTime };
      const { duplicate, conflicts } = analyzeEntry(entry, [...kept, ...placed].map((other) => ({ entry: other })));
      const found = conflicts[0]?.entry;
      if (duplicate) notes[time.key] = "This class time is already there, so we add it once.";
      else if (found) {
        const day = SHORT_DAY[clashDay(days, found)];
        notes[time.key] = `${day} ${lower(time.startTime)} to ${lower(time.endTime)} overlaps ${found.title}. You can still add it.`;
      }
      placed.push(entry);
    }
  }
  return notes;
}

// ---- The review ----

// "Mon, Wed 8:00 am · Fri 1:00 pm"
export const scheduleSummary = (subject) =>
  filledTimes(subject)
    .map((time) => `${inWeekOrder(time.days).map((day) => SHORT_DAY[day]).join(", ")} ${lower(time.startTime)}`)
    .join(" · ");
