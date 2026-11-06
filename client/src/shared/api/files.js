import { del, get, patch, post } from "./http";

// The student's own files (plan 19). Every call answers { data } or { error } (see http.js); a failed
// answer carries the API's `code` ("files_paused", "quota_full", "bad_type"...) next to its message.

// `where` is a place: "general", "subject:<id>" or "folder:<id>". Without it, every file.
// Answers { files, locations: { subjects, folders }, usage: { usedBytes, limitBytes }, uploads }.
export const fetchFiles = (where) => get(`/api/files${where ? `?in=${encodeURIComponent(where)}` : ""}`);

// One file as multipart (the place goes in the query: the server checks it before it reads the body).
// `thumb` is an optional small JPEG of a photo. `onProgress` gets 0 to 1 as bytes go out; `signal`
// cancels the request. Answers { file }.
export function uploadFile(file, { to, thumb, onProgress, signal }) {
  const form = new FormData();
  form.append("file", file);
  if (thumb) form.append("thumb", thumb, "thumb.jpg");
  return post(`/api/files?to=${encodeURIComponent(to)}`, form, {
    signal,
    onUploadProgress: ({ loaded, total }) => onProgress?.(total ? loaded / total : 0),
  });
}

export const deleteFile = (id) => del(`/api/files/${encodeURIComponent(id)}`);

// Folders. The server checks the name (1 to 60 characters, not General, not a subject's name, not
// one of the student's folders) and answers a plain message, with status 409 for a name taken.
// Answers { folder: { id, name } }.
export const createFolder = (name) => post("/api/files/folders", { name });
export const renameFolder = (id, name) => patch(`/api/files/folders/${encodeURIComponent(id)}`, { name });

// `files` says what happens to the folder's files: "keep" moves them to General, "delete" removes them.
export const deleteFolder = (id, files) => del(`/api/files/folders/${encodeURIComponent(id)}?files=${files}`);

// Short-lived download links for up to 24 of the student's files. `variant` is "thumb" (the small
// preview of a photo) or "file". Answers { links: [{ id, url, expiresAt }] }. Only shared/lib/fileLinks.js
// calls this, so a link never sits anywhere but its cache.
export const fetchFileLinks = (ids, variant) => post("/api/files/links", { ids, variant });
