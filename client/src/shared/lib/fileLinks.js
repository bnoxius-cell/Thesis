import { fetchFileLinks } from "@/shared/api/files";
import { backendUrl } from "@/shared/api/http";

// Short-lived links to the student's stored files (plan 19, 3.2). A link is a secret for about a
// minute, so this module is the only place one lives. It never logs a link and never puts one in
// React state, context or the page address; callers read it at render for an `src` or an `href`, or
// pass it straight to `location.assign`.
//
// Photo previews (thumbs) are cached for the tab and mirrored to sessionStorage: the browser keeps
// the image itself for a day, so an expired link is still good for showing it, and a reload or a
// second list never asks again. Full-size links die with their minute, so they are cached in memory
// only and reused only while they have 5 seconds or more left.

const STORAGE_KEY = "stresscare:file-links";
const MAX_ENTRIES = 500;
const BATCH_SIZE = 24; // what the server answers in one request
const BATCH_WINDOW_MS = 30; // thumbs asked for within this window go out together
const FRESH_MS = 5000;

const keyOf = (id, variant) => `${id}:${variant}`;

const isEntry = ([key, entry]) =>
  typeof key === "string" && typeof entry?.url === "string" && Number.isFinite(entry.expiresAt);

function restore() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    return new Map(Array.isArray(stored) ? stored.filter(isEntry) : []);
  } catch {
    return new Map();
  }
}

// key -> { url, expiresAt (ms) }, oldest first.
const cache = restore();

function persistThumbs() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...cache].filter(([key]) => key.endsWith(":thumb"))));
  } catch {
    // Private windows and full storage just mean the next load asks again.
  }
}

// The memory store's links are relative to the API (/api/files/dev/...), so in local development
// they need the API's address.
const absolute = (url) => (url.startsWith("/") ? backendUrl + url : url);

function remember(links, variant) {
  for (const { id, url, expiresAt } of links) {
    const key = keyOf(id, variant);
    cache.delete(key); // re-insert at the end, so the oldest entries go first
    cache.set(key, { url: absolute(url), expiresAt: Date.parse(expiresAt) || Date.now() });
  }
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
  if (variant === "thumb") persistThumbs();
}

// The cached link for an <img src> or an <a href>, or null. Expired links are returned too: an image
// that is already on screen must keep its source when the page renders again.
export const linkUrl = (id, variant) => cache.get(keyOf(id, variant))?.url ?? null;

const usable = (id, variant) => {
  const entry = cache.get(keyOf(id, variant));
  return Boolean(entry) && (variant === "thumb" || entry.expiresAt - Date.now() >= FRESH_MS);
};

// After an image fails to load: the next ensureLink / loadThumb asks for a fresh link.
export function forgetLink(id, variant) {
  cache.delete(keyOf(id, variant));
  if (variant === "thumb") persistThumbs();
}

// One request for up to 24 ids of one variant. Answers {} or { error, code }.
async function fetchBatch(ids, variant) {
  const { data, error, code } = await fetchFileLinks(ids, variant);
  if (error) return { error, code };
  remember(data.links, variant);
  return {};
}

// A link for one file, ready to use: { url } or { error, code } with the server's own message.
// Opening a document and showing a full photo both come through here.
export async function ensureLink(id, variant) {
  if (!usable(id, variant)) {
    const failed = await fetchBatch([id], variant);
    if (failed.error) return failed;
  }
  return usable(id, variant) ? { url: linkUrl(id, variant) } : { error: "Couldn't open that file." };
}

// --- Photo previews, asked for in groups ---
// A list shows the previews that scroll into view, which can be many at once. Asking within a short
// window and sending them in batches keeps a 100-photo folder from spending 100 requests.

const waiting = new Map(); // id -> { promise, settle, sent }
let timer = null;

function flush() {
  timer = null;
  const batch = [...waiting].filter(([, job]) => !job.sent);
  batch.forEach(([, job]) => {
    job.sent = true;
  });
  for (let start = 0; start < batch.length; start += BATCH_SIZE) {
    const jobs = batch.slice(start, start + BATCH_SIZE);
    fetchBatch(jobs.map(([id]) => id), "thumb").then(() => {
      jobs.forEach(([id, job]) => {
        waiting.delete(id);
        job.settle(usable(id, "thumb"));
      });
    });
  }
}

// Resolves true when the preview's link is cached, false when it couldn't be fetched.
export function loadThumb(id) {
  if (usable(id, "thumb")) return Promise.resolve(true);
  if (!waiting.has(id)) {
    let settle;
    const promise = new Promise((resolve) => {
      settle = resolve;
    });
    waiting.set(id, { promise, settle, sent: false });
    timer ??= setTimeout(flush, BATCH_WINDOW_MS);
  }
  return waiting.get(id).promise;
}
