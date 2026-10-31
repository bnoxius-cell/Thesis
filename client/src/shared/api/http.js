import axios from "axios";

// Same rule as AuthContext: the deployed site goes through Vercel's same-origin /api rewrite so the
// session cookie stays first-party, and local development talks to Express directly.
export const backendUrl = import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? "http://localhost:5000" : "");

const OFFLINE = "Can't reach StressCare. Check your connection and try again.";
const FAILED = "Something went wrong. Please try again.";

// One request, never throws. Answers { data } on success or { error } with a message that is safe
// to show: the server's own plain message when it sent one, a generic line otherwise.
export async function request(method, path, body) {
  try {
    const { data } = await axios({ method, url: backendUrl + path, data: body, withCredentials: true });
    if (data?.success === false) return { error: data.message || FAILED };
    return { data };
  } catch (err) {
    if (!err.response) return { error: OFFLINE };
    return { error: err.response.data?.message || FAILED };
  }
}

export const get = (path) => request("get", path);
export const put = (path, body) => request("put", path, body);
export const post = (path, body) => request("post", path, body);
export const del = (path) => request("delete", path);
