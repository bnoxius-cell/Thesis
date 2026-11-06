import { useCallback, useMemo, useState } from "react";
import { fetchUnreadSummary } from "@/shared/api/notifications";
import usePolling from "@/shared/hooks/usePolling";
import { UnreadContext } from "./unreadContext";

const POLL_MS = 20000;
const NONE = { total: 0, friendRequests: 0, groupEntries: [] };

// Polls the unread summary for the whole signed-in area and shares the numbers the badges need:
//   total          unread notifications (the bell)
//   groupsUnread   groups with something new (People > Groups)
//   groupUnread    { [groupId]: unread messages } for the badge on each group row
//   friendRequests incoming friend requests still waiting (People > Friends)
//   markGroupRead  clears one group's count at once, once its chat has been opened (the server
//                  has already marked them read; this only saves waiting for the next poll)
//   refresh        polls now, so a count follows an action at once (accepting a friend request)
// The friend-request count comes in the same response, so there is no second request.
export default function UnreadProvider({ children }) {
  const [counts, setCounts] = useState(NONE);

  const refresh = useCallback(async () => {
    const { data } = await fetchUnreadSummary();
    // A failed poll keeps the last numbers: a badge that vanishes offline would be wrong news.
    if (!data) return;
    setCounts({
      total: data.unreadCount ?? 0,
      friendRequests: data.pendingFriendRequests ?? 0,
      groupEntries: (data.groups ?? []).map((g) => ({ id: String(g.group), count: g.count })),
    });
  }, []);

  usePolling(refresh, POLL_MS);

  const markGroupRead = useCallback((groupId) => {
    setCounts((prev) => {
      const id = String(groupId);
      const cleared = prev.groupEntries.filter((e) => e.id === id).length;
      if (!cleared) return prev;
      return {
        ...prev,
        total: Math.max(0, prev.total - cleared),
        groupEntries: prev.groupEntries.filter((e) => e.id !== id),
      };
    });
  }, []);

  const value = useMemo(() => {
    const groupUnread = {};
    counts.groupEntries.forEach(({ id, count }) => {
      groupUnread[id] = (groupUnread[id] ?? 0) + count;
    });
    return {
      total: counts.total,
      groupsUnread: Object.keys(groupUnread).length,
      groupUnread,
      friendRequests: counts.friendRequests,
      markGroupRead,
      refresh,
    };
  }, [counts, markGroupRead, refresh]);

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}
