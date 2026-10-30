// Matches the --subject-<key> tokens in styles/tokens.css and SUBJECT_COLORS on the server.
export const SUBJECT_COLORS = ["blue", "teal", "green", "olive", "amber", "orange", "violet", "slate"];

// "IT 301", "IT-301" and "it301 " all become "it301". Same function as courseKey in
// server/utils/subjectMatch.js (a server test keeps them identical). An empty key matches nothing.
export const courseKey = (value) => (
  typeof value === "string" ? value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") : ""
);

// What a subject is called on a task or reviewer: its code if it has one, otherwise its name.
export const subjectLabel = (subject) => subject.code || subject.name;

// The subject whose name or code matches a free-text label, or null.
export function subjectForLabel(label, subjects) {
  const key = courseKey(label);
  if (!key) return null;
  return subjects.find((s) => courseKey(s.name) === key || courseKey(s.code) === key) || null;
}

// "IT 301 · 1st sem 2026-27": the code and term when there are any.
export const subjectMeta = (subject) => [subject.code, subject.term].filter(Boolean).join(" · ");

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// "Linked 6 tasks and 1 reviewer." (or "" when nothing was linked)
export function linkedMessage({ tasks = 0, reviewers = 0 } = {}) {
  const parts = [tasks && plural(tasks, "task"), reviewers && plural(reviewers, "reviewer")].filter(Boolean);
  return parts.length ? `Linked ${parts.join(" and ")}.` : "";
}

// The first colour none of these subjects uses (the server picks the same way), else the first.
export function nextSubjectColor(subjects = []) {
  const used = new Set(subjects.map((s) => s.color));
  return SUBJECT_COLORS.find((c) => !used.has(c)) || SUBJECT_COLORS[0];
}
