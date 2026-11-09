// Relative imports with .js, so the server tests can load this file like the other pure client utils.
import { formatSize } from "../../shared/lib/formatSize.js";
import { filesText } from "../files/fileKinds.js";
import { extensionOf } from "../files/fileRules.js";

// The New reviewer form's numbers and checks. They match the server (utils/reviewerContent.js,
// utils/reviewerSource.js and the upload route), which checks them again from the file's bytes.

export const QUESTION_COUNTS = [10, 15, 20, 30, 50, 100];
export const DEFAULT_QUESTION_COUNT = 15;

const MB = 1024 * 1024;
export const MAX_SOURCES = 10;
export const MAX_SOURCE_BYTES = 10 * MB;
export const MAX_SOURCES_BYTES = 20 * MB;

// What a reviewer can be made from: PDF, Word, PowerPoint and photos. Excel and text files are
// stored in Files but can't be read here.
const SOURCE_EXTS = ["pdf", "docx", "pptx", "png", "jpg", "jpeg", "webp"];
// For <input accept>: phones convert other photo formats to JPEG when the type is listed.
export const SOURCE_ACCEPT = [...SOURCE_EXTS.map((ext) => `.${ext}`), "image/jpeg", "image/png", "image/webp"].join(",");

// The Subject dropdown's last option. Never a real subject id.
export const NEW_SUBJECT = "new-subject";

const TOO_MANY = `You can add up to ${MAX_SOURCES} files to one reviewer.`;
const TOO_BIG_TOGETHER = `Those files are too big together. The limit is ${formatSize(MAX_SOURCES_BYTES)} for one reviewer.`;

// A plain message naming the file when it can't be used, or "" when it can.
export function sourceProblem(file) {
  if (!SOURCE_EXTS.includes(extensionOf(file.name))) {
    return `${file.name} can't be made into a reviewer. Use PDF, Word or PowerPoint files, or photos (PNG, JPG or WebP).`;
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return `${file.name} is too big. Each file can be up to ${formatSize(MAX_SOURCE_BYTES)}.`;
  }
  return "";
}

const totalBytes = (items) => items.reduce((sum, item) => sum + item.size, 0);

// Whether one more file of `size` fits next to `count` files of `bytes` together.
const roomProblem = (count, bytes, size) => {
  if (count >= MAX_SOURCES) return TOO_MANY;
  return bytes + size > MAX_SOURCES_BYTES ? TOO_BIG_TOGETHER : "";
};

let nextEntryId = 0;

// Adds the picked files to the list ([{ id, file }]), one by one: a file that can't be used is left out
// with its message and the rest stay. Answers { entries, problems }.
export function takeSources(current, incoming) {
  const entries = [...current];
  const problems = [];
  let bytes = totalBytes(entries.map((entry) => entry.file));
  for (const file of incoming) {
    const problem = sourceProblem(file) || roomProblem(entries.length, bytes, file.size);
    if (problem) {
      if (!problems.includes(problem)) problems.push(problem);
      continue;
    }
    entries.push({ id: nextEntryId++, file });
    bytes += file.size;
  }
  return { entries, problems };
}

// One line for the picker's problems: the first, and how many more files it left out.
export function problemsMessage(problems) {
  const [first, ...rest] = problems;
  if (!first) return "";
  return rest.length ? `${first} ${rest.length} more couldn't be added.` : first;
}

// The stored files (from a place's listing) a reviewer can use.
export const usableSources = (files) => files.filter((file) => SOURCE_EXTS.includes(file.ext));

// Whether a stored file can still be ticked next to the ones already picked.
export const canPickStored = (picked, file) => roomProblem(picked.length, totalBytes(picked), file.size) === "";

// "3 files · 14.2 MB of 20 MB".
export const sourceCounter = (items) => `${filesText(items.length)} · ${formatSize(totalBytes(items))} of ${formatSize(MAX_SOURCES_BYTES)}`;

// The message that blocks Create, or "" when a reviewer can be made. `limits` is what the list
// answered: { dailyLimit, usedToday, enabled }.
export function limitMessage(limits) {
  if (!limits) return "";
  if (limits.enabled === false) return "Reviewers aren't set up on this server yet.";
  if (limits.usedToday >= limits.dailyLimit) {
    return "You've reached today's limit for making reviewers. You can make more tomorrow.";
  }
  return "";
}

// What is sent. `kind` is the active source: "upload" sends `files` (File objects) as repeated
// `files` fields, "stored" sends `fileIds` as one comma-separated field. Never both.
export function reviewerPayload({ kind, files = [], fileIds = [], title, subject, count }) {
  const form = new FormData();
  form.append("title", title.trim());
  if (subject) form.append("subject", subject);
  form.append("questionCount", String(count));
  if (kind === "stored") form.append("fileIds", fileIds.join(","));
  else files.forEach((file) => form.append("files", file));
  return form;
}
