import { del, get, post } from "./http";

// Every call answers { data } or { error } (see http.js).

// The student's reviewers, newest first: { reviewers, dailyLimit, usedToday, enabled }. Each row carries
// title, course, subject, status ("processing" | "ready" | "failed"), source (type, file count, pages or slides), counts
// and the last session score.
export const fetchReviewers = () => get("/api/reviewers");

// Sends the source as multipart: `form` is a FormData with title, subject, questionCount and either
// repeated `files` (PDF, Word, PowerPoint or photos, up to 10) or one `fileIds` field (stored files,
// comma-separated). The answer is { reviewer } still "processing"; the server writes it in the background.
export const createReviewer = (form) => post("/api/reviewers", form);

// Just { status, error, version, targeted }, cheap enough to poll while a reviewer is being made.
export const fetchReviewerStatus = (id) => get(`/api/reviewers/${id}/status`);

export const fetchReviewer = (id) => get(`/api/reviewers/${id}`);
export const deleteReviewer = (id) => del(`/api/reviewers/${id}`);
export const fetchReviewerProgress = (id) => get(`/api/reviewers/${id}/progress`);

// Learning Mode. `mode` is "all" or "weak". A session carries its questions without the answers:
// { _id, mode, total, questions: [{ _id, type, prompt, options, topic, difficulty, count? }], answers: [result] }
// where `type` is mc | tf | id | fill | enum (`count` is an enumeration's number of items) and each
// result is { questionId, type, correct, correctIndex, explanation } plus what fits the type, for a
// question already answered (so a session can resume): choice (mc, tf), text and answer (id, fill),
// entries, got, of, items and matched (enum).
export const startSession = (id, mode) => post(`/api/reviewers/${id}/sessions`, { mode });
export const fetchSession = (id, sessionId) => get(`/api/reviewers/${id}/sessions/${sessionId}`);

// The server grades the answer and only then answers with { result, answered, total }. `body` is
// { choice } (mc, tf), { text } (id, fill) or { entries } (enum): see features/practice/answerDraft.js.
export const answerQuestion = (id, sessionId, questionId, body) =>
  post(`/api/reviewers/${id}/sessions/${sessionId}/answer`, { questionId, ...body });

// Closes the session: { session, review, progress }, or session null when nothing was answered.
export const finishSession = (id, sessionId) => post(`/api/reviewers/${id}/sessions/${sessionId}/finish`, {});
