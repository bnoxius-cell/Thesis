// What the student has typed or picked for one question, before it is checked. The shape follows the
// question's type: a picked option (mc, tf), a text (id, fill) or one text per item (enum).
// Pure, so the draft rules sit apart from the screens.

export const questionKind = (question) => question.type ?? "mc";

// The blank draft for a question: null (nothing picked), "" or one empty box per item.
export function emptyDraft(question) {
  switch (questionKind(question)) {
    case "id":
    case "fill":
      return "";
    case "enum":
      return Array(question.count).fill("");
    default:
      return null;
  }
}

// Whether there is enough to check. An enumeration needs one box filled: the server counts the rest as missed.
export function isDraftReady(question, draft) {
  switch (questionKind(question)) {
    case "id":
    case "fill":
      return draft.trim() !== "";
    case "enum":
      return draft.some((entry) => entry.trim() !== "");
    default:
      return draft !== null;
  }
}

// The answer route's body, without the question id.
export function answerBody(question, draft) {
  switch (questionKind(question)) {
    case "id":
    case "fill":
      return { text: draft.trim() };
    case "enum":
      return { entries: draft };
    default:
      return { choice: draft };
  }
}
