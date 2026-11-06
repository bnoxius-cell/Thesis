import axios from "axios";

// Same rule as AuthContext: a deployed build always calls its own /api (Vercel rewrites it to the API),
// so the session cookie stays first-party on every address the site is served from (vercel.app and
// stresscare.xyz). VITE_BACKEND_URL only matters in local development.
export const backendUrl = import.meta.env.DEV ? (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000") : "";

const OFFLINE = "Can't reach StressCare. Check your connection and try again.";
const FAILED = "Something went wrong. Please try again.";

// One request, never throws. Answers { data } on success or { error } with a message that is safe
// to show: the server's own plain message when it sent one, a generic line otherwise. A failed
// answer from the server also carries `status` (the HTTP code), `code` (the API's own short name for
// the problem, like "files_paused") and `fromApi` (true when the body is the API's own
// { success: false } reply, false for a bare proxy or deploy error page). `config` is passed to
// axios for what a plain call doesn't need: `onUploadProgress`, and `signal` to cancel. A cancelled
// request answers { cancelled: true } with no message to show.
export async function request(method, path, body, config = {}) {
  try {
    const { data } = await axios({ ...config, method, url: backendUrl + path, data: body, withCredentials: true });
    if (data?.success === false) return { error: data.message || FAILED };
    return { data };
  } catch (err) {
    if (axios.isCancel(err)) return { error: "", cancelled: true };
    if (!err.response) return { error: OFFLINE };
    return {
      error: err.response.data?.message || FAILED,
      status: err.response.status,
      code: err.response.data?.code,
      fromApi: err.response.data?.success === false,
    };
  }
}

export const get = (path) => request("get", path);
export const put = (path, body) => request("put", path, body);
export const patch = (path, body) => request("patch", path, body);
export const post = (path, body, config) => request("post", path, body, config);
export const del = (path) => request("delete", path);
