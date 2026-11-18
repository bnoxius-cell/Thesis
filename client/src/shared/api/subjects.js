import { del, get, patch, post } from "./http";

// Every call answers { data } or { error } (see http.js).
export const fetchSubjects = () => get("/api/subjects");
export const createSubject = (fields) => post("/api/subjects", fields);
export const updateSubject = (id, fields) => patch(`/api/subjects/${id}`, fields);
// `files` says what happens to the subject's files: "keep" (the server's default) moves them to
// General, "delete" removes them.
export const deleteSubject = (id, files = "keep") => del(`/api/subjects/${id}?files=${files}`);
// One subject with its counts. Answers 404 for an unknown id and for another student's subject.
export const fetchSubject = (id) => get(`/api/subjects/${encodeURIComponent(id)}`);

// The subject's class times (each says where it lives and whether the student may change it), the next two weeks
// of its classes and its exams, from the timetables that count in the student's week. `startIso` is today.
export const fetchSubjectSchedule = (id, startIso) => get(`/api/subjects/${encodeURIComponent(id)}/schedule?start=${startIso}`);

// Archived subjects, with the class times kept on them (`pastClassTimes`) and their counts.
export const fetchArchivedSubjects = () => get("/api/subjects?archived=1");
// Ends a subject for a term: its class times leave the timetable (kept on the subject), everything else stays.
// Answers { subject }.
export const archiveSubject = (id) => post(`/api/subjects/${encodeURIComponent(id)}/archive`);
// Brings it back and puts its class times in the main timetable. Answers { subject, classTimesAdded, skipped,
// timetableFull }; 409 when an active subject already has its name.
export const restoreSubject = (id) => post(`/api/subjects/${encodeURIComponent(id)}/restore`);
// "Start a new term" in one request: { archive: [subjectId], term?, firstDay?, subjects: [{ name, code?, classTimes:
// [{ days, startTime, endTime, location? }] }] }. Answers { archived, subjects, classTimesAdded, skipped }.
export const applyNewTerm = (body) => post("/api/subjects/new-term", body);
