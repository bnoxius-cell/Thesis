import { get, post, put, del } from "./http";

// Every call answers { data } or { error } (see http.js). The payload for create and update is
//   { title, course?, description?, dueDate: "YYYY-MM-DD", hours, difficulty?, importance?, isCompleted? }
export const fetchTasks = () => get("/api/tasks");
export const createTask = (payload) => post("/api/tasks", payload);
export const updateTask = (taskId, fields) => put(`/api/tasks/${taskId}`, fields);
export const deleteTask = (taskId) => del(`/api/tasks/${taskId}`);

// Adds a copy of a task someone shared (by its 6-digit share tag) to the student's own tasks.
// Answers 409 when they already have it.
export const importSharedTask = (shareTag) => post("/api/tasks/import", { shareTag });
