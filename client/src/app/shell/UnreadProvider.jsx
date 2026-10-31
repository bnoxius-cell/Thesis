import { useCallback, useMemo, useState } from "react";
import { fetchInbox } from "@/shared/api/notifications";
import usePolling from "@/shared/hooks/usePolling";
import { UnreadContext } from "./unreadContext";

const POLL_MS = 20000;
// Chat-like notifications fold into one entry per group while unread, so counting the groups
// that have one tells how many chats have news.
const GROUP_TYPES = ["group_message", "group_task", "group_schedule"];

const NONE = { total: 0, friendRequests: 0, groupIds: [] };

// Polls the inbox for the whole signed-in area and shares the numbers the badges need:
//   total          unread notifications (the bell)
//   groupsUnread   groups with something new (People > Groups)
//   friendRequests incoming friend requests still waiting (People > Friends)
//   markGroupRead  clears one group's count at once, once its chat has been opened (the server
//                  has already marked them read; this only saves waiting for the next poll)
// The friend-request count comes in the same response, so there is no second request.
export default function UnreadProvider({ children }) {
  const [counts, setCounts] = useState(NONE);

  const refresh = useCallback(async () => {
    const { data } = await fetchInbox();
    // A failed poll keeps the last numbers: a badge that vanishes offline would be wrong news.
    if (!data) return;
    setCounts({
      total: data.unreadCount ?? 0,
      friendRequests: data.pendingFriendRequests ?? 0,
      groupIds: (data.notifications ?? [])
        .filter((n) => !n.isRead && n.group && GROUP_TYPES.includes(n.type))
        .map((n) => String(n.group)),
    });
  }, []);

  usePolling(refresh, POLL_MS);

  const markGroupRead = useCallback((groupId) => {
    setCounts((prev) => {
      const id = String(groupId);
      const cleared = prev.groupIds.filter((g) => g === id).length;
      if (!cleared) return prev;
      return {
        ...prev,
        total: Math.max(0, prev.total - cleared),
        groupIds: prev.groupIds.filter((g) => g !== id),
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      total: counts.total,
      groupsUnread: new Set(counts.groupIds).size,
      friendRequests: counts.friendRequests,
      markGroupRead,
    }),
    [counts, markGroupRead],
  );

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}
