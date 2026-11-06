import { del, get, patch, post } from "./http";

// Every call answers { data } or { error } (see http.js).

// The student's groups: { groups }. Each has _id, name, icon (a picture or ""), joinCode, pinned,
// admin, admins and members (people as { _id, name, avatar }). There is no last-message preview.
export const fetchGroups = () => get("/api/groups");

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
