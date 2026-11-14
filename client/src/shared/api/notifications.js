import { get, put } from "./http";

// The inbox, newest first, with two counts the server works out itself: `unreadCount` (notifications
// not yet read) and `pendingFriendRequests` (requests still waiting for an answer).
export const fetchInbox = () => get("/api/notifications");

// Just the badge numbers, small enough to poll: `unreadCount`, `pendingFriendRequests` and `groups`
// ([{ group, count }], the unread chat news per group). No notification bodies, no avatars. The
// inbox list above is for when the student opens it, never for a timer.
export const fetchUnreadSummary = () => get("/api/notifications/summary");

// The student's notification settings: { preferences }. `groupOverrides` is [{ group, level }] with
// level "tasks" (shared tasks only) or "muted"; a group missing from it follows the account ("all").
export const fetchPreferences = () => get("/api/notifications/preferences");

// Saves just the fields sent (the server leaves the rest alone): { preferences }, or { error }.
export const savePreferences = (fields) => put("/api/notifications/preferences", fields);

// Saves one group's level ("all" | "tasks" | "muted"). The server replaces the whole override list,
// so this reads the current list first and changes only that group's entry: { preferences }.
export async function saveGroupLevel(groupId, level) {
  const { data, error } = await fetchPreferences();
  if (!data) return { error };
  const others = (data.preferences.groupOverrides ?? []).filter((o) => o.group !== groupId);
  return put("/api/notifications/preferences", { groupOverrides: [...others, { group: groupId, level }] });
}
