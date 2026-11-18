import { MAX_CLASS_TIMES, classTimesBody, clashNotes, emptyClassTime, keptEntries, timeErrors } from "./term/newTermForm.js";
import { subjectChanged, subjectForm, subjectNameError, subjectPayload } from "./subjectForm.js";

// The Add subject form (Figma MS-1): the subject's name and code, and its class times, which go on the main
// timetable. Pure helpers, no React, so the server tests can run them. The class time rows, their checks and
// their body are the new-term wizard's (term/newTermForm.js); the server checks everything again.
//
// The form is { name, code, term, classTimes: [{ key, days, startTime, endTime, location }] }. `term` isn't
// asked for here, so it stays empty. It starts with no class times: they are optional.
export const emptyAddSubjectForm = () => ({ ...subjectForm(null), classTimes: [] });

const mapTime = (form, key, change) => ({ ...form, classTimes: form.classTimes.map((time) => (time.key === key ? change(time) : time)) });

export const addTime = (form) =>
  form.classTimes.length >= MAX_CLASS_TIMES ? form : { ...form, classTimes: [...form.classTimes, emptyClassTime(true)] };
export const changeTime = (form, key, fields) => mapTime(form, key, (time) => ({ ...time, ...fields }));
export const removeTime = (form, key) => ({ ...form, classTimes: form.classTimes.filter((time) => time.key !== key) });

// Whether closing should ask first: a field typed, or a class time row added or changed.
export const addSubjectStarted = (start, form) =>
  subjectChanged(start, form) || JSON.stringify(start.classTimes) !== JSON.stringify(form.classTimes);

// { name, times }: the message for a missing name ("" when fine) and the messages for the class times that can't
// be saved as they are, by class time key. Both empty when the form can be sent.
export const addSubjectErrors = (form) => ({ name: subjectNameError(form), times: timeErrors(form) });
export const hasErrors = ({ name, times }) => Boolean(name) || Object.keys(times).length > 0;

// Warnings (never blocks) for the class times that overlap one already on the main timetable or typed above
// them, by class time key. `entries` is the main timetable's entries, empty while it loads.
export const clashNotesFor = (form, entries) => clashNotes({ firstDay: "", subjects: [form] }, keptEntries(entries, []));

// The body of POST /api/subjects.
export const addSubjectPayload = (form) => ({ ...subjectPayload(form), classTimes: classTimesBody(form) });
