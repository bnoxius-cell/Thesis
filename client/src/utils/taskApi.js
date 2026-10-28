import axios from "axios";

// The one create/update call for tasks. The quick-add row, the Today page and the task dialog all go
// through it, so the server sees the same payload shape everywhere:
//   { title, course?, description?, dueDate: "YYYY-MM-DD", hours, difficulty?, importance? }
// Resolves to { task } on success or { error } with a message that is safe to show.
export async function saveTaskRequest(backendUrl, payload, taskId) {
  try {
    const { data } = taskId
      ? await axios.put(`${backendUrl}/api/tasks/${taskId}`, payload, { withCredentials: true })
      : await axios.post(`${backendUrl}/api/tasks`, payload, { withCredentials: true });
    if (!data.success) return { error: data.message || "Couldn't save the task." };
    return { task: data.task };
  } catch (err) {
    return { error: err.response?.data?.message || "Couldn't save the task. Check your connection and try again." };
  }
}
