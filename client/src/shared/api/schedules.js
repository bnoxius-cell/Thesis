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

// Copies every entry of a timetable posted in a group's chat into the student's main timetable:
// { added, schedule }. `entryIds` are the _ids of the entries inside that message's snapshot.
export const importSharedTimetable = (groupId, messageId, entryIds) =>
  request("post", "/api/schedules/import", { groupId, messageId, selections: entryIds.map((id) => ({ id })) });

const timetablePath = (id) => `/api/schedules/${encodeURIComponent(id)}`;
const entryPath = (scheduleId, entryId) => `${timetablePath(scheduleId)}/entries/${encodeURIComponent(entryId)}`;

// Entry writes answer { schedule }: the whole timetable after the change. `entry` is the full entry
// ({ title, kind, days or date, startTime, endTime, location, meetingUrl, notes, prepHours, ... }), and an
// edit replaces the stored entry, so send every field you want to keep.
// Adds to the student's main timetable and creates it ("My timetable") when they have none.
export const addMyEntry = (entry) => request("post", "/api/schedules/main/entries", entry);
// Add and edit need the owner or an editor of that timetable (403 otherwise).
export const addEntry = (scheduleId, entry) => request("post", `${timetablePath(scheduleId)}/entries`, entry);
export const updateEntry = (scheduleId, entryId, entry) => request("put", entryPath(scheduleId, entryId), entry);
export const deleteEntry = (scheduleId, entryId) => request("delete", entryPath(scheduleId, entryId));

// Owner only. `fields` is any of { title, theme, countInWorkload, isMain, editorsCanShare }.
export const updateTimetable = (id, fields) => request("put", timetablePath(id), fields);
// Anyone but the owner: whether this shared timetable counts in their own week and workload.
export const updateMembership = (id, countInWorkload) => request("put", `${timetablePath(id)}/membership`, { countInWorkload });
// Owner only. The main timetable can't be deleted while the student has extra ones.
export const deleteTimetable = (id) => request("delete", timetablePath(id));
// A member removes themselves from a timetable shared with them.
export const leaveTimetable = (id, userId) => request("delete", `${timetablePath(id)}/share/${encodeURIComponent(userId)}`);

// A member's own layer over a timetable shared with them (a group's, or a friend's): what they take, hide or
// keep their own version of. Every call answers { myClasses } (and the extras named below), and none of them
// changes the shared timetable except publishMyClass. The week the server resolves is read again afterwards.
const minePath = (scheduleId) => `${timetablePath(scheduleId)}/mine`;
const minePathOf = (scheduleId, entryId) => `${minePath(scheduleId)}/classes/${encodeURIComponent(entryId)}`;

// The join checklist: `taking` are the class ids they attend. Hides the rest and turns on Count in my week.
export const setUpClasses = (scheduleId, taking) => request("put", `${minePath(scheduleId)}/setup`, { taking });
// "I take this" ("follow") or "Not taking this" ("hidden"). Following a class they customized deletes their copy.
export const chooseClass = (scheduleId, entryId, choice) => request("put", minePathOf(scheduleId, entryId), { choice });
// "Customize mine": answers { scheduleId, entryId }, the copy now in their own timetable (the same copy on a retry).
export const customizeClass = (scheduleId, entryId) => request("post", `${minePathOf(scheduleId, entryId)}/customize`);
// "Make it all mine": a copy of every class they still follow. Answers { customized }.
export const customizeAllClasses = (scheduleId) => request("post", `${minePath(scheduleId)}/customize-all`);
// Dismisses the notice on a customized class and keeps their version.
export const keepMyClass = (scheduleId, entryId) => request("post", `${minePathOf(scheduleId, entryId)}/keep-mine`);
// Editors only: their copy becomes the class for everyone (409 when the class moved since they customized it).
export const publishMyClass = (scheduleId, entryId) => request("post", `${minePathOf(scheduleId, entryId)}/publish`);

// Proposals (plan 40, 2.5): a member who can't edit a shared timetable proposes the time of their own copy of a class.
const proposalsPath = (scheduleId) => `${timetablePath(scheduleId)}/proposals`;
// Answers { proposal }. 409 when the class changed since they customized it or they already proposed it.
export const proposeMyClass = (scheduleId, entryId) => request("post", `${minePathOf(scheduleId, entryId)}/propose`);
// The open proposals: { proposals: [{ _id, entry, title, proposer: { _id, name }, fields, base, status, stale, createdAt }] }.
// Editors get every one, anyone else only their own.
export const fetchProposals = (scheduleId) => request("get", proposalsPath(scheduleId));
// Editors decide (approve is 409 when the class changed since); the proposer withdraws their own. All 409 once closed.
export const approveProposal = (scheduleId, proposalId) => request("post", `${proposalsPath(scheduleId)}/${encodeURIComponent(proposalId)}/approve`);
export const declineProposal = (scheduleId, proposalId) => request("post", `${proposalsPath(scheduleId)}/${encodeURIComponent(proposalId)}/decline`);
export const withdrawProposal = (scheduleId, proposalId) => request("post", `${proposalsPath(scheduleId)}/${encodeURIComponent(proposalId)}/withdraw`);
