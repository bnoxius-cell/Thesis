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
