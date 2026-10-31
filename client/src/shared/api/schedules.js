import { request } from "./http";

// The seven days from `startIso` ("YYYY-MM-DD") of everything the student's timetable puts on the week,
// with holidays and upcoming exams.
export const fetchWeekOverview = (startIso) => request("get", `/api/schedules/week?start=${startIso}`);

// Every timetable the student can open (their own and the ones shared with them), without entries.
export const fetchTimetables = () => request("get", "/api/schedules");

// One timetable with its entries. Answers 404 for an unknown id and 403 when it isn't shared with them.
export const fetchTimetable = (id) => request("get", `/api/schedules/${encodeURIComponent(id)}`);

// A tiny check that answers { updatedAt }: the live check compares it before downloading the timetable again.
export const fetchTimetableStamp = (id) => request("get", `/api/schedules/${encodeURIComponent(id)}/stamp`);

// Philippine public holidays of one year: { holidays: [{ date, name }] }.
export const fetchHolidays = (year) => request("get", `/api/schedules/holidays?year=${year}`);

// True when the server itself said the timetable is gone or no longer shared. A bare 404 from a
// proxy in the middle of a deploy is not an answer, so the caller keeps what it has.
export const isTimetableGone = (res) => res.fromApi === true && [403, 404].includes(res.status);

// The student's main timetable with its entries: { schedule } (null when they have none yet).
export const fetchMainTimetable = () => request("get", "/api/schedules/main");
