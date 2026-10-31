// What the header search can find, built from lists the app already loads. Each entry goes to a
// route that exists today.
export const SEARCH_KINDS = { subject: "Subject", reviewer: "Reviewer", task: "Task" };

const MAX_RESULTS = 8;

export function buildSearchIndex({ subjects = [], reviewers = [], tasks = [] }) {
  return [
    ...subjects.map((s) => ({
      key: `subject-${s._id}`,
      kind: "subject",
      label: s.name,
      sub: [s.code, s.term].filter(Boolean).join(" · "),
      to: `/study/subjects/${s._id}`,
    })),
    ...reviewers.map((r) => ({
      key: `reviewer-${r._id}`,
      kind: "reviewer",
      label: r.title,
      sub: r.course || "",
      to: `/study/reviewers/${r._id}`,
    })),
    ...tasks
      .filter((t) => !t.isCompleted)
      .map((t) => ({
        key: `task-${t._id}`,
        kind: "task",
        label: t.title,
        sub: t.course || "",
        to: "/plan?view=tasks",
      })),
  ];
}

// Every word typed has to appear in the label or the line under it; labels that start with the
// first word come first. An empty query finds nothing.
export function searchEntries(entries, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const found = entries.filter((entry) => {
    const text = `${entry.label} ${entry.sub}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
  const starts = (entry) => (entry.label.toLowerCase().startsWith(words[0]) ? 0 : 1);
  return found.sort((a, b) => starts(a) - starts(b)).slice(0, MAX_RESULTS);
}
