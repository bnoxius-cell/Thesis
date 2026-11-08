import { PDF_TYPE, looksLikePdf, viewKindOf } from "@/utils/fileView";
import { ensureLink, forgetLink } from "./fileLinks";

// A stored file's bytes, fetched once and kept for the tab (plan 23, 4.1 and 4.2). The viewer shows a
// PDF or a text file from them and Download saves them, so viewing then downloading is one read.
//
// Safety: the signed link comes from fileLinks and goes straight into fetch; it is never logged, kept
// or put in state, and neither is the response's address. A Blob's type comes from the file's own
// extension, never from the response, and a PDF is only typed as one when its bytes start "%PDF-": a
// Blob URL is same-origin with the app, so anything else in a frame could run as the app. The bytes
// live in memory only, at most 5 files and 30 MB, and leave on sign-out, on a change of account and
// when the file is deleted.
//
// When the browser can't read the storage's answer at all (no CORS rule, a preview deploy, the
// network), `fallback` is set and the rest of the tab skips the fetch, so callers fall back to a
// plain download instead of spending another read.

const MAX_BLOBS = 5;
const MAX_BLOB_BYTES = 30 * 1024 * 1024;
const LOAD_FAILED = "Couldn't load this file. Try again in a moment.";
const CANT_SHOW = "Couldn't show this file here.";
const ABORTED = Object.freeze({ error: null, aborted: true });

const blobs = new Map(); // id -> Blob, oldest first
const jobs = new Map(); // id -> { id, promise, controller, waiting }: loads on their way, one per file
let fetchBroken = false;

const failed = (error, { code, fallback = false } = {}) => ({ error, code, fallback });

const BLOB_TYPES = { pdf: PDF_TYPE, text: "text/plain" };
const blobTypeOf = (ext) => BLOB_TYPES[viewKindOf(ext)] ?? "application/octet-stream";

function store(id, blob) {
  blobs.delete(id); // re-insert at the end, so the oldest go first
  blobs.set(id, blob);
  let total = 0;
  blobs.forEach((kept) => {
    total += kept.size;
  });
  for (const [oldId, old] of blobs) {
    if (blobs.size <= MAX_BLOBS && total <= MAX_BLOB_BYTES) break;
    blobs.delete(oldId);
    total -= old.size;
  }
}

// One link and one fetch: { response }, or a finished answer (an error, a fallback, aborted).
async function fetchOnce(file, signal) {
  const link = await ensureLink(file.id, "file");
  if (signal.aborted) return ABORTED;
  if (link.error) return failed(link.error, { code: link.code });
  try {
    return { response: await fetch(link.url, { credentials: "omit", referrerPolicy: "no-referrer", signal }) };
  } catch {
    if (signal.aborted) return ABORTED;
    fetchBroken = true;
    return failed(CANT_SHOW, { fallback: true });
  }
}

async function readBlob(file, response, signal) {
  let buffer;
  try {
    buffer = await response.arrayBuffer();
  } catch {
    return signal.aborted ? ABORTED : failed(LOAD_FAILED);
  }
  if (buffer.byteLength !== file.size) return failed(LOAD_FAILED);
  if (viewKindOf(file.ext) === "pdf" && !looksLikePdf(new Uint8Array(buffer))) return failed(CANT_SHOW);
  return { blob: new Blob([buffer], { type: blobTypeOf(file.ext) }) };
}

async function fetchFile(file, signal) {
  let fetched = await fetchOnce(file, signal);
  if (fetched.response?.status === 403) {
    forgetLink(file.id, "file"); // the link ran out on the way: one more try with a fresh one
    fetched = await fetchOnce(file, signal);
  }
  if (!fetched.response) return fetched;
  if (!fetched.response.ok) return failed(LOAD_FAILED);
  return readBlob(file, fetched.response, signal);
}

function startJob(file) {
  const job = { id: file.id, controller: new AbortController(), waiting: 0 };
  job.promise = fetchFile(file, job.controller.signal)
    .then((result) => {
      if (result.blob && jobs.get(file.id) === job) store(file.id, result.blob);
      return result;
    })
    .finally(() => {
      if (jobs.get(file.id) === job) jobs.delete(file.id);
    });
  jobs.set(file.id, job);
  return job;
}

// A caller with a signal can leave early; the fetch itself stops only when every caller has left, so
// a Download pressed while the viewer loads still gets the file after the viewer closes.
function waitFor(job, signal) {
  job.waiting += 1;
  if (!signal) return job.promise;
  return new Promise((resolve, reject) => {
    const leave = () => {
      resolve(ABORTED);
      job.waiting -= 1;
      if (job.waiting > 0) return;
      if (jobs.get(job.id) === job) jobs.delete(job.id);
      job.controller.abort();
    };
    signal.addEventListener("abort", leave, { once: true });
    job.promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", leave));
  });
}

// The file's bytes: { blob }, { error, code, fallback } with a message to show, or
// { error: null, aborted: true } when `signal` aborted (nothing is kept then). Calls for the same file
// share one fetch. `file` is a library row: { id, ext, size }.
export function loadFileBlob(file, { signal } = {}) {
  const cached = blobs.get(file.id);
  if (cached) return Promise.resolve({ blob: cached });
  if (fetchBroken) return Promise.resolve(failed(CANT_SHOW, { fallback: true }));
  if (signal?.aborted) return Promise.resolve(ABORTED);
  return waitFor(jobs.get(file.id) ?? startJob(file), signal);
}

export const cachedFileBlob = (id) => blobs.get(id) ?? null;

export const blobFetchBroken = () => fetchBroken;

// After a delete: the bytes go, and a load still on its way keeps nothing.
export function dropFileBlob(id) {
  blobs.delete(id);
  jobs.delete(id);
}

// On sign-out or a change of account, next to clearFileLinks: nothing of one student stays for the next.
export function clearFileBlobs() {
  jobs.forEach((job) => job.controller.abort());
  jobs.clear();
  blobs.clear();
  fetchBroken = false;
}
