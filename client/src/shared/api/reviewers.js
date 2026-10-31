import { del, get, post } from "./http";

// Every call answers { data } or { error } (see http.js).

// The student's reviewers, newest first: { reviewers, dailyLimit, usedToday, enabled }. Each row carries
// title, course, subject, status ("processing" | "ready" | "failed"), source (file name, pages), counts
// and the last session score.
export const fetchReviewers = () => get("/api/reviewers");

// Sends the PDF as multipart: `form` is a FormData with pdf, title, subject and questionCount. The
// answer is { reviewer } still "processing"; the server writes it in the background.
export const createReviewer = (form) => post("/api/reviewers", form);

// Just { status, error, version, targeted }, cheap enough to poll while a reviewer is being made.
export const fetchReviewerStatus = (id) => get(`/api/reviewers/${id}/status`);

export const fetchReviewer = (id) => get(`/api/reviewers/${id}`);
export const deleteReviewer = (id) => del(`/api/reviewers/${id}`);
export const fetchReviewerProgress = (id) => get(`/api/reviewers/${id}/progress`);

// Learning Mode. `mode` is "all" or "weak". A session carries its questions without the answers:
// { _id, mode, total, questions: [{ _id, prompt, options, topic, difficulty }], answers: [result] }
// where each result is { questionId, choice, correct, correctIndex, explanation } for a question
// already answered (so a session can resume).
export const startSession = (id, mode) => post(`/api/reviewers/${id}/sessions`, { mode });
export const fetchSession = (id, sessionId) => get(`/api/reviewers/${id}/sessions/${sessionId}`);

// The server grades the pick and only then answers with { result, answered, total }.
export const answerQuestion = (id, sessionId, questionId, choice) =>
  post(`/api/reviewers/${id}/sessions/${sessionId}/answer`, { questionId, choice });

// Closes the session: { session, review, progress }, or session null when nothing was answered.
export const finishSession = (id, sessionId) => post(`/api/reviewers/${id}/sessions/${sessionId}/finish`, {});
