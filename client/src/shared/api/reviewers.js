import { get } from "./http";

// The student's reviewers, newest first: { reviewers, dailyLimit, usedToday, enabled }. Each row carries
// title, course, subject, status ("processing" | "ready" | "failed"), counts and the last session score.
export const fetchReviewers = () => get("/api/reviewers");
