// The New subject / Edit subject form. Limits match SUBJECT_LIMITS on the server, which checks
// them again. The colour is not asked for: the server picks a free one on create, and an edit
// leaves it alone (the pages only draw four tones anyway).
export const SUBJECT_LIMITS = { name: 80, code: 20, term: 40 };

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

export const subjectForm = (subject) => ({
  name: subject?.name ?? "",
  code: subject?.code ?? "",
  term: subject?.term ?? "",
});

// What is sent: the three text fields, trimmed the way the server trims them.
export const subjectPayload = (form) => ({
  name: clean(form.name),
  code: clean(form.code),
  term: clean(form.term),
});

export const subjectChanged = (start, form) => {
  const before = subjectPayload(start);
  const after = subjectPayload(form);
  return Object.keys(after).some((key) => before[key] !== after[key]);
};

// The message for a missing name, or "" when the form can be sent.
export const subjectNameError = (form) => (subjectPayload(form).name ? "" : "Give the subject a name.");
