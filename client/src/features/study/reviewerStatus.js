import { daysAgoText } from "@/shared/lib/dates";
import { filesText } from "@/features/files/fileKinds";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// What a reviewer was made from, in a few words: "PDF · 14 pages", "Word", "PowerPoint · 20 slides",
// "Photo" or "3 files". A reviewer made before there were several kinds has no type and is a PDF.
export function sourceLabel(reviewer) {
  const { type = "pdf", count = 1, pages = 0, slides = 0 } = reviewer.source ?? {};
  if (count > 1) return filesText(count);
  if (type === "docx") return "Word";
  if (type === "image") return "Photo";
  if (type === "pptx") return ["PowerPoint", slides && plural(slides, "slide")].filter(Boolean).join(" · ");
  return ["PDF", pages && plural(pages, "page")].filter(Boolean).join(" · ");
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

// "PDF · 14 pages · added 2 days ago" (see sourceLabel). A failed reviewer shows the reason instead.
export function reviewerMeta(reviewer) {
  if (reviewer.status === "failed" && reviewer.error) return reviewer.error;
  return [sourceLabel(reviewer), `added ${daysAgoText(reviewer.createdAt).toLowerCase()}`].join(" · ");
}

// "PDF · 14 pages · Databases": what the reviewer was made from (Figma 76:1270).
export function reviewerSourceLine(reviewer) {
  return [sourceLabel(reviewer), reviewer.course].filter(Boolean).join(" · ");
}
