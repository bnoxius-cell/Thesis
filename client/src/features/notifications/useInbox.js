import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useUnread } from "@/app/shell/unreadContext";
import { clearAllNotifications, fetchInbox, markAllRead, markRead } from "@/shared/api/notifications";
import { toAppLink } from "./notificationLink";

// The inbox list for the drawer and the page. It loads once when it mounts (the panel is only mounted
// while it is on screen), never on a timer. While it is open it loads again, quietly, whenever the
// shell's unread total changes, which is how a new message shows up within one 20 second poll.
//   status     "loading" | "ready" | "failed" (a failed quiet refresh keeps the list on screen)
//   items      notifications, newest first
//   open(n)    marks it read at once and answers the app path it points to (null when it has none)
//   markAll    marks everything read
//   clearAll   removes everything
//   reload     tries the first load again
export default function useInbox() {
  const { total, refresh } = useUnread();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const latest = useRef(0);

  const load = useCallback(async ({ quiet = false } = {}) => {
    const mine = ++latest.current;
    if (!quiet) setStatus("loading");
    const { data } = await fetchInbox();
    if (mine !== latest.current) return; // a newer load has already answered
    if (data) {
      setItems(data.notifications ?? []);
      setStatus("ready");
    } else if (!quiet) {
      setStatus("failed");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const seenTotal = useRef(total);
  useEffect(() => {
    if (seenTotal.current === total) return;
    seenTotal.current = total;
    load({ quiet: true });
  }, [total, load]);

  const open = useCallback(
    (notification) => {
      if (!notification.isRead) {
        setItems((list) => list.map((n) => (n._id === notification._id ? { ...n, isRead: true } : n)));
        markRead(notification._id).then(({ error }) => {
          if (error) load({ quiet: true }); // a row that is already gone: show the list as it is now
          refresh();
        });
      }
      return toAppLink(notification.link);
    },
    [load, refresh],
  );

  const markAll = useCallback(async () => {
    setItems((list) => list.map((n) => (n.isRead ? n : { ...n, isRead: true })));
    const { error } = await markAllRead();
    if (error) {
      toast.error(error);
      load({ quiet: true });
    }
    refresh();
  }, [load, refresh]);

  const clearAll = useCallback(async () => {
    const { error } = await clearAllNotifications();
    if (error) {
      toast.error(error);
      return;
    }
    setItems([]);
    refresh();
  }, [refresh]);

  return { status, items, open, markAll, clearAll, reload: load };
}
