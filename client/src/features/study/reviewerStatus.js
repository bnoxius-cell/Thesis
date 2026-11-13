import { daysAgoText } from "@/shared/lib/dates";
import { filesText } from "@/features/files/fileKinds";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const PAGE_CHARS = 3000;

// Pages in one source item. A reviewer made before there were several kinds has no type and is a PDF.
// Word and notes have no fixed pages (Word's count is used when the file has one), so they count a page
// per PAGE_CHARS characters. Skipped files still count: they were uploaded.
const itemPages = ({ type = "pdf", pages = 0, slides = 0, chars = 0 }) => {
  if (type === "pdf") return pages;
  if (type === "pptx") return slides;
  if (type === "image") return 1;
  return pages > 0 ? pages : Math.max(1, Math.ceil(chars / PAGE_CHARS));
};

// Total pages across a reviewer's files. Old reviewers have no items, so their summary is one item.
export function pageCount(reviewer) {
  const items = reviewer.source?.items ?? [reviewer.source ?? {}];
  return items.reduce((total, item) => total + itemPages(item), 0);
}

// What a reviewer was made from: "1 file · 14 pages", "3 files · 20 pages" or "1 file" when no page count is known.
export function sourceLabel(reviewer) {
  const { count = 1 } = reviewer.source ?? {};
  const pages = pageCount(reviewer);
  return [filesText(count), pages > 0 && plural(pages, "page")].filter(Boolean).join(" · ");
}

// What a reviewer row says about itself, from one list item. The list carries the last finished
// Learning Mode score (lastScore), how many sessions are done and whether a session is open
// (hasOpenSession), so a reviewer reads "New" until its first session starts, "In progress" while
// one is open or after, and "Done" from 80%.
export function reviewerChip(reviewer) {
  if (reviewer.status === "processing") return { tone: "accent", label: "Making it", busy: true };
  if (reviewer.status === "failed") return { tone: "danger", label: "Didn't work" };
  if (reviewer.hasOpenSession) return { tone: "accent", label: "In progress" };
  if (!reviewer.sessions) return { tone: "neutral", label: "New" };
  return reviewer.lastScore >= 80 ? { tone: "good", label: "Done" } : { tone: "accent", label: "In progress" };
}

// "Learning Mode 60%", "Learning Mode in progress" (open session, nothing finished yet) or
// "Not started"; nothing while the reviewer is still being made or failed.
export function reviewerProgress(reviewer) {
  if (reviewer.status !== "ready") return "";
  if (reviewer.hasOpenSession && !reviewer.sessions) return "Learning Mode in progress";
  return reviewer.sessions ? `Learning Mode ${Math.round(reviewer.lastScore)}%` : "Not started";
}

// "1 file · 14 pages · added 2 days ago" (see sourceLabel). A failed reviewer shows the reason instead.
export function reviewerMeta(reviewer) {
  if (reviewer.status === "failed" && reviewer.error) return reviewer.error;
  return [sourceLabel(reviewer), `added ${daysAgoText(reviewer.createdAt).toLowerCase()}`].join(" · ");
}

// "2 files · 14 pages · Databases": what the reviewer was made from (Figma 76:1270).
export function reviewerSourceLine(reviewer) {
  return [sourceLabel(reviewer), reviewer.course].filter(Boolean).join(" · ");
}

const QUESTION_TYPE_LABELS = {
  mixed: "Mixed questions",
  multiple_choice: "Multiple choice",
  true_false: "True or false",
  identification: "Identification",
  fill_blank: "Fill in the blank",
  enumeration: "Enumeration",
  essay: "Essay questions",
};

// "Mixed questions", "True or false", ...: what kinds of question a reviewer holds. Reviewers made before
// types existed have none and are multiple choice.
export const questionTypeLabel = (questionType) => QUESTION_TYPE_LABELS[questionType] ?? QUESTION_TYPE_LABELS.multiple_choice;
