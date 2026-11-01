import { get } from "./http";

// The inbox, newest first, with two counts the server works out itself: `unreadCount` (notifications
// not yet read) and `pendingFriendRequests` (requests still waiting for an answer).
export const fetchInbox = () => get("/api/notifications");

// Just the badge numbers, small enough to poll: `unreadCount`, `pendingFriendRequests` and `groups`
// ([{ group, count }], the unread chat news per group). No notification bodies, no avatars. The
// inbox list above is for when the student opens it, never for a timer.
export const fetchUnreadSummary = () => get("/api/notifications/summary");
