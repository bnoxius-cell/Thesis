import { del, get, patch, post } from "./http";

// Every call answers { data } or { error } (see http.js).
export const fetchSubjects = () => get("/api/subjects");
export const createSubject = (fields) => post("/api/subjects", fields);
export const updateSubject = (id, fields) => patch(`/api/subjects/${id}`, fields);
export const deleteSubject = (id) => del(`/api/subjects/${id}`);
