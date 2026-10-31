import { request } from "./http";

// The seven days from `startIso` ("YYYY-MM-DD") of everything the student's timetable puts on the week,
// with holidays and upcoming exams.
export const fetchWeekOverview = (startIso) => request("get", `/api/schedules/week?start=${startIso}`);
