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
