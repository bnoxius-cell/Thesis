import { get } from "./http";

// The inbox, newest first, with two counts the server works out itself: `unreadCount` (notifications
// not yet read) and `pendingFriendRequests` (requests still waiting for an answer).
export const fetchInbox = () => get("/api/notifications");
