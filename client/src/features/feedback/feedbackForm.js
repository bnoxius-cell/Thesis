// The feedback form. The limits match FEEDBACK_LIMITS on the server, which checks them again.
export const FEEDBACK_MIN = 10;
export const FEEDBACK_MAX = 1000;

export const FEEDBACK_KINDS = [
  { value: "idea", label: "Idea" },
  { value: "problem", label: "Problem" },
  { value: "unclear", label: "Unclear" },
  { value: "other", label: "Other" },
];

export const emptyFeedbackForm = () => ({ kind: "idea", message: "", canContact: false });

export const feedbackStarted = (form) => form.message.trim().length > 0;

export const feedbackErrors = (form) =>
  form.message.trim().length < FEEDBACK_MIN ? { message: `Tell us a little more (at least ${FEEDBACK_MIN} characters).` } : {};

// The phone and tablet widths follow the layout breakpoints (the bottom bar goes at 1024).
export const deviceFor = (width) => (width < 600 ? "phone" : width < 1024 ? "tablet" : "desktop");

// The request body. `pathname` is the page the student was on (no search or hash), `width` the window
// width at the moment of sending.
export const feedbackPayload = (form, pathname, width) => ({
  kind: form.kind,
  message: form.message.trim(),
  page: pathname,
  device: deviceFor(width),
  canContact: form.canContact,
});
