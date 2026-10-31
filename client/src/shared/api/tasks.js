import { get, post, put, del } from "./http";

// Every call answers { data } or { error } (see http.js). The payload for create and update is
//   { title, course?, description?, dueDate: "YYYY-MM-DD", hours, difficulty?, importance?, isCompleted? }
export const fetchTasks = () => get("/api/tasks");
export const createTask = (payload) => post("/api/tasks", payload);
export const updateTask = (taskId, fields) => put(`/api/tasks/${taskId}`, fields);
export const deleteTask = (taskId) => del(`/api/tasks/${taskId}`);
