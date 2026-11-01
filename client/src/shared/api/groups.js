import { get, post } from "./http";

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
