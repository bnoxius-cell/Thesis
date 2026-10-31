import { get, post } from "./http";

// The check-ins. The server works the score out from the answers (it ignores any score sent), so only
// the picked answer values go up, in question order. Answers { data: { score } } or { error }.
export const submitSurvey = (kind, responses) => post(`/api/surveys/${kind}`, { responses });

// The last 5 results of each check-in, newest first: { pss: [{ score, createdAt }], who: [...] }.
export const fetchSurveyHistory = () => get("/api/surveys/history");
