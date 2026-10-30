import axios from "axios";

// Calls for /api/subjects. Each one resolves to { data } on success or { error } with a message
// that is safe to show, like saveTaskRequest in taskApi.js.
async function call(request, fallback) {
  try {
    const { data } = await request();
    if (!data.success) return { error: data.message || fallback };
    return { data };
  } catch (err) {
    return { error: err.response?.data?.message || `${fallback} Check your connection and try again.` };
  }
}

const options = { withCredentials: true };

export const fetchSubjects = (backendUrl) => call(
  () => axios.get(`${backendUrl}/api/subjects`, options),
  "Couldn't load your subjects.",
);

export const fetchSuggestions = (backendUrl) => call(
  () => axios.get(`${backendUrl}/api/subjects/suggestions`, options),
  "Couldn't look for subjects.",
);

export const createSubjectRequest = (backendUrl, body) => call(
  () => axios.post(`${backendUrl}/api/subjects`, body, options),
  "Couldn't save the subject.",
);

export const updateSubjectRequest = (backendUrl, id, body) => call(
  () => axios.patch(`${backendUrl}/api/subjects/${id}`, body, options),
  "Couldn't save the subject.",
);

export const deleteSubjectRequest = (backendUrl, id) => call(
  () => axios.delete(`${backendUrl}/api/subjects/${id}`, options),
  "Couldn't delete the subject.",
);
