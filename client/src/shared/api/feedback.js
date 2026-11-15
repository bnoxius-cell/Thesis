import { post } from "./http";

// Answers { data } or { error } (see http.js). The payload is
//   { kind: "idea" | "problem" | "unclear" | "other", message, page, device, canContact }
// and the 429 and 409 answers carry the plain message to show.
export const sendFeedback = (payload) => post("/api/feedback", payload);
