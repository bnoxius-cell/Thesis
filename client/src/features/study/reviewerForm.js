// The New reviewer form's numbers and checks. They match the server (utils/reviewerContent.js and
// the upload route), which checks them again.

export const QUESTION_COUNTS = [10, 15, 20, 30];
export const DEFAULT_QUESTION_COUNT = 15;
export const MAX_PDF_MB = 10;

export const formatBytes = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

// A plain message when the picked file can't be used, or "" when it can.
export function pdfProblem(file) {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) return "That isn't a PDF. Pick a .pdf file.";
  if (file.size > MAX_PDF_MB * 1024 * 1024) {
    return `That PDF is ${formatBytes(file.size)}. The limit is ${MAX_PDF_MB} MB.`;
  }
  return "";
}

// The message that blocks Create, or "" when a reviewer can be made. `limits` is what the list
// answered: { dailyLimit, usedToday, enabled }.
export function limitMessage(limits) {
  if (!limits) return "";
  if (limits.enabled === false) return "Reviewers aren't set up on this server yet.";
  if (limits.usedToday >= limits.dailyLimit) {
    return `You've made ${limits.dailyLimit} reviewers in the last 24 hours. You can make more tomorrow.`;
  }
  return "";
}

export function reviewerPayload({ file, title, subject, count }) {
  const form = new FormData();
  form.append("title", title.trim());
  if (subject) form.append("subject", subject);
  form.append("questionCount", String(count));
  form.append("pdf", file);
  return form;
}
