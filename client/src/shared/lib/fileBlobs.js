import { UNSHOWABLE, blobTypeOf, blobsToDrop, bytesFit, statusStep } from "@/utils/fileView";
import { ensureLink, forgetLink } from "./fileLinks";

// A stored file's bytes, fetched once and kept for the tab (plan 23, 4.1 and 4.2). The viewer shows a
// PDF or a text file from them and Download saves them, so viewing then downloading is one read.
//
// Safety: the signed link comes from fileLinks and goes straight into fetch; it is never logged, kept
// or put in state, and neither is the response's address. A Blob's type comes from the file's own
// extension, never from the response, and a PDF is only typed as one when its bytes start "%PDF-": a
// Blob URL is same-origin with the app, so anything else in a frame could run as the app. The bytes
// live in memory only, at most 5 files and 30 MB, and leave on sign-out, on a change of account and
// when the file is deleted. Any failed fetch forgets its link, so trying again asks for a fresh one.
//
// When the browser can't read the storage's answer at all, fetch throws: no CORS rule, a preview
// deploy, the network, and also any error status from the storage, which answers errors without the
// CORS header. Such an answer has `fallback` set: Download then opens the file in a new tab instead
// (see downloadFile), and never sends the app itself to the link. The tab remembers it only as a hint
// (`fetchBroken`), so the next Download opens its tab straight from the click; the next fetch that
// works clears it, and the viewer always tries the fetch again.

const LOAD_FAILED = "Couldn't load this file. Try again in a moment.";
const CANT_SHOW = "Couldn't show this file here.";
const ABORTED = Object.freeze({ error: null, aborted: true });

const blobs = new Map(); // id -> Blob, oldest first
const jobs = new Map(); // id -> { id, promise, controller, waiting }: loads on their way, one per file
const unshowable = new Set(); // ids whose bytes came but can't be shown, so Download goes to a tab
const listeners = new Set();
let fetchBroken = false;
let generation = 0; // counts clearFileBlobs calls, so a viewer still open drops what it holds

const failed = (error, { code, fallback = false } = {}) => ({ error, code, fallback });

function store(id, blob) {
  blobs.delete(id); // re-insert at the end, so the oldest go first
  blobs.set(id, blob);
  blobsToDrop([...blobs].map(([keptId, kept]) => [keptId, kept.size])).forEach((oldId) => blobs.delete(oldId));
}

// One link and one fetch: { response }, or a finished answer (an error, a fallback, aborted).
async function fetchOnce(file, signal) {
  const link = await ensureLink(file.id, "file");
  if (signal.aborted) return ABORTED;
  if (link.error) return failed(link.error, { code: link.code });
  try {
    const response = await fetch(link.url, { credentials: "omit", referrerPolicy: "no-referrer", signal });
    fetchBroken = false;
    return { response };
  } catch {
    if (signal.aborted) return ABORTED;
    forgetLink(file.id, "file");
    fetchBroken = true;
    return failed(LOAD_FAILED, { fallback: true });
  }
}

async function readBlob(file, response, signal) {
  let buffer;
  try {
    buffer = await response.arrayBuffer();
  } catch {
    return signal.aborted ? ABORTED : failed(LOAD_FAILED);
  }
  if (!bytesFit(file, new Uint8Array(buffer))) {
    unshowable.add(file.id);
    return failed(CANT_SHOW, { code: UNSHOWABLE, fallback: true });
  }
  return { blob: new Blob([buffer], { type: blobTypeOf(file.ext) }) };
}

async function fetchFile(file, signal) {
  for (let retried = false; ; retried = true) {
    const fetched = await fetchOnce(file, signal);
    if (!fetched.response) return fetched;
    const step = statusStep(fetched.response.status, retried);
    if (step === "read") return readBlob(file, fetched.response, signal);
    forgetLink(file.id, "file");
    if (step === "fail") return failed(LOAD_FAILED);
  }
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

// The file's bytes: { blob }, { error, code, fallback } with a message to show (code UNSHOWABLE when
// the bytes came but can't be shown), or { error: null, aborted: true } when `signal` aborted (nothing
// is kept then). Calls for the same file share one fetch. `file` is a library row: { id, ext, size }.
export function loadFileBlob(file, { signal } = {}) {
  const cached = blobs.get(file.id);
  if (cached) return Promise.resolve({ blob: cached });
  if (signal?.aborted) return Promise.resolve(ABORTED);
  if (unshowable.has(file.id)) return Promise.resolve(failed(CANT_SHOW, { code: UNSHOWABLE, fallback: true }));
  return waitFor(jobs.get(file.id) ?? startJob(file), signal);
}

export const cachedFileBlob = (id) => blobs.get(id) ?? null;

// True when Download should open the file in a new tab without trying the fetch first.
export const needsNewTab = (id) => fetchBroken || unshowable.has(id);

// For useSyncExternalStore: the number changes when clearFileBlobs runs.
export const fileBlobGeneration = () => generation;

export function subscribeFileBlobs(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// After a delete: the bytes go, and a load still on its way keeps nothing.
export function dropFileBlob(id) {
  blobs.delete(id);
  jobs.delete(id);
  unshowable.delete(id);
}

// On sign-out or a change of account, next to clearFileLinks: nothing of one student stays for the next.
export function clearFileBlobs() {
  jobs.forEach((job) => job.controller.abort());
  jobs.clear();
  blobs.clear();
  unshowable.clear();
  fetchBroken = false;
  generation += 1;
  listeners.forEach((listener) => listener());
}
