import { del, get, patch, post } from "./http";

// Every call answers { data } or { error } (see http.js).

// The student's groups: { groups }. Each has _id, name, icon (a picture or ""), joinCode, pinned,
// admin, admins and members (people as { _id, name, avatar }). There is no last-message preview.
export const fetchGroups = () => get("/api/groups");

// Starts a group; the student becomes its owner. `fields` is { name, description?, familyFriendly? }.
// The answer is { group } (with _id and joinCode). The server trims the text, refuses an empty name,
// and limits the name to 60 characters and the description to 140.
export const createGroup = (fields) => post("/api/groups", fields);

// Joins a group by its 6-character code (any case): { group }. A wrong code answers "Group not found",
// a group the student is already in answers "Already a member of this group".
export const joinGroup = (joinCode) => post("/api/groups/join", { joinCode });

// A group's chat. With no cursor it answers the latest 50 messages. With `after` (the id of the
// newest message already shown) and `since` (the `serverTime` of the previous answer) it answers
// only newer messages plus `changes` for older ones. The answer always carries `serverTime` and
// `readNotifications`: how many of this group's unread notifications the server just marked read.
export function fetchMessages(groupId, cursor) {
  const query = cursor ? `?after=${cursor.after}&since=${encodeURIComponent(cursor.since)}` : "";
  return get(`/api/groups/${groupId}/messages${query}`);
}

// Posts plain text (the server trims it and allows up to 1000 characters): { message }.
export const sendMessage = (groupId, text) => post(`/api/groups/${groupId}/messages`, { text });

// Posts one of the student's own items as a card: `body` is { taskId }, { scheduleId } or { reviewerId }
// (one of them): { message }. The server checks the item is theirs (404 otherwise) and, for a reviewer, that
// it is ready and named (409 with the reason). A family-friendly group refuses a card whose words don't pass
// with `code: "family_filter"` and a message that is safe to show.
export const shareToGroup = (groupId, body) => post(`/api/groups/${groupId}/messages`, body);

// Saves a groupmate's shared reviewer card into the student's own Study: { saved: { type, _id, title } }. A
// second save answers 409 "It's already in your Study."
export const saveFromMessage = (groupId, messageId) => post(`/api/groups/${groupId}/messages/${messageId}/save`);

// The deadlines people shared in a group, soonest first: { deadlines }. Each has _id, task (title,
// course, dueDate, shareTag...), addedByMe, sharedBy ({ _id, name } or null) and sharedAt. It lists
// shared tasks only: classes and exams are not part of it.
export const fetchUpcoming = (groupId) => get(`/api/groups/${groupId}/upcoming`);

// Changes a group. Owner and admins only. `fields` is any of { name, pinned } (a pinned note of ""
// clears it); the answer is the whole updated group: { group }. The server trims both, refuses an
// empty name, a name over 60 characters and a note over 280, and runs the family filter on the note.
export const updateGroup = (groupId, fields) => patch(`/api/groups/${groupId}`, fields);

// The student leaves a group (the owner can't: they delete it instead).
export const leaveGroup = (groupId) => post("/api/groups/leave", { groupId });

// Owner only: ends the group for everyone.
export const deleteGroup = (groupId) => del(`/api/groups/${groupId}`);

// Owner only: promote a member to admin, or take it back.
export const addAdmin = (groupId, userId) => post(`/api/groups/${groupId}/admins`, { userId });
export const removeAdmin = (groupId, userId) => del(`/api/groups/${groupId}/admins/${userId}`);

// Owner and admins: removes a regular member (an admin can't remove another admin).
export const removeMember = (groupId, userId) => del(`/api/groups/${groupId}/members/${userId}`);

// The group's plan: { role, tasks, timetable, myClasses, serverTime }. `role` is "editor" (owner and admins) or
// "viewer". Each task has title, course, description, dueDate, hours, difficulty, importance, isCompleted,
// completedAt and createdBy, updatedBy and completedBy as { _id, name } (or null).
export const fetchGroupPlan = (groupId) => get(`/api/groups/${groupId}/plan`);

// What the plan screen polls: { planAt, timetableAt, presence }. `planAt` moves whenever the plan changes;
// `presence` is [{ userId, editing }] for the other members who have it open, `editing` the id of the task
// they have a dialog open on (or null). Passing `editingId` tells the others the caller is editing that task.
export const fetchPlanStamp = (groupId, editingId) =>
  get(`/api/groups/${groupId}/plan/stamp${editingId ? `?editing=${editingId}` : ""}`);

// Owner and admins: adds a task. `fields` is { title, course?, description?, dueDate: "YYYY-MM-DD", hours?,
// difficulty?, importance? }: { task }. A family-friendly group refuses words that don't pass with
// `code: "family_filter"`.
export const createGroupTask = (groupId, fields) => post(`/api/groups/${groupId}/tasks`, fields);

// Owner and admins: changes only the fields in `changes`, each checked against what it was when the form
// opened (`expected`, the same keys). 200 { task } when saved; 409 with `body: { task, conflicts }` when
// someone changed one of those fields to something else first (`conflicts` names them, `task` is theirs);
// 404 once the task has been deleted.
export const updateGroupTask = (groupId, taskId, { changes, expected }) =>
  patch(`/api/groups/${groupId}/tasks/${taskId}`, { changes, expected });

// Owner and admins: removes a task for everyone. 404 when it is already gone.
export const deleteGroupTask = (groupId, taskId) => del(`/api/groups/${groupId}/tasks/${taskId}`);

// Owner and admins: makes the group's timetable (titled with the group's name, not counted in anyone's week
// until they switch it on): { timetable }, the same summary the plan carries. 409 when the group has one.
export const createGroupTimetable = (groupId) => post(`/api/groups/${groupId}/timetable`);
