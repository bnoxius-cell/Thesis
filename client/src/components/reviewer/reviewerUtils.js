// Shared bits for the reviewer pages. The numbers match the server
// (server/utils/reviewerContent.js, server/routes/reviewerRoutes.js).

export const QUESTION_COUNTS = [10, 15, 20, 30];
export const DEFAULT_QUESTION_COUNT = 15;
export const MAX_PDF_MB = 10;
export const LETTERS = ["A", "B", "C", "D"];

export const formatBytes = (bytes) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const titleFromFileName = (name) => name.replace(/\.pdf$/i, "").replace(/_+/g, " ").trim();

export const errorMessage = (err, fallback) => err?.response?.data?.message || fallback;

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });

// Topic levels from the server, in words a student would use.
export const LEVEL_LABEL = {
  strong: "Strong",
  fair: "Getting there",
  weak: "Needs review",
  new: "Not tried yet",
};

export const scoreMessage = (score) => {
  if (score === null || score === undefined) return "";
  if (score >= 80) return "Strong work. You know this material well.";
  if (score >= 60) return "Good progress. A little more review on the topics below will help.";
  return "A good place to start. Go over the topics below, then try again.";
};
