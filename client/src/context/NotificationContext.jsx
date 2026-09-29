import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth } from "../pages/authentication/AuthContext";
import { syncPush } from "../utils/pushClient";

const NotificationContext = createContext(null);

const POLL_MS = 20000;
const BASE_TITLE = "StressCare";

// Owns the inbox for the whole app: polls the server while the tab is visible, pops an
// in-app toast for anything new, keeps the unread count on the tab title and app icon,
// and reacts to the service worker (push arrived, notification clicked).
// App.jsx keys this by user id, so a new account always starts from a clean slate.
export function NotificationProvider({ children }) {
  const { backendUrl, isLoggedin, userData } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Remembers what has already been shown as a toast, so a poll never repeats one.
  // Collapsed chat entries change their count, which counts as new activity.
  const seen = useRef(null);
  const userId = userData?._id;

  const refresh = useCallback(async () => {
    if (!isLoggedin) return;
    try {
      const { data } = await axios.get(`${backendUrl}/api/notifications`);
      if (!data.success) throw new Error(data.message);

      const list = data.notifications;
      const keyOf = (n) => `${n._id}:${n.count}`;

      if (seen.current === null) {
        seen.current = new Set(list.map(keyOf));
      } else {
        const fresh = list.filter((n) => !n.isRead && !seen.current.has(keyOf(n)));
        fresh.slice(0, 3).forEach((n) => {
          toast.info(
            <div>
              <strong>{n.title || "StressCare"}</strong>
              <div>{n.message}</div>
            </div>,
            { onClick: () => n.link && navigate(n.link), toastId: keyOf(n) }
          );
        });
        list.forEach((n) => seen.current.add(keyOf(n)));
      }

      setNotifications(list);
      setUnreadCount(data.unreadCount);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, [backendUrl, isLoggedin, navigate]);

  // Poll while the tab is in front, and catch up the moment it comes back.
  useEffect(() => {
    if (!isLoggedin) return undefined;
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [isLoggedin, refresh]);

  // Re-attach this browser's push subscription after login, if they opted in earlier.
  useEffect(() => {
    if (isLoggedin && userId) syncPush(backendUrl, userId);
  }, [isLoggedin, userId, backendUrl]);

  // Messages from the service worker.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    const onMessage = (event) => {
      if (event.data?.type === "notification-arrived") refresh();
      if (event.data?.type === "navigate") {
        const url = new URL(event.data.url);
        navigate(url.pathname + url.search);
        refresh();
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [refresh, navigate]);

  // Unread count on the tab title and, where supported, the installed app icon.
  useEffect(() => {
    const count = isLoggedin ? unreadCount : 0;
    document.title = count > 0 ? `(${count}) ${BASE_TITLE}` : BASE_TITLE;
    if (count > 0) navigator.setAppBadge?.(count)?.catch?.(() => {});
    else navigator.clearAppBadge?.()?.catch?.(() => {});
  }, [unreadCount, isLoggedin]);

  const markRead = useCallback(async (id) => {
    const target = notifications.find((n) => n._id === id);
    if (!target || target.isRead) return;
    setNotifications((list) => list.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await axios.put(`${backendUrl}/api/notifications/${id}/read`);
    } catch { refresh(); }
  }, [backendUrl, notifications, refresh]);

  const markAllRead = useCallback(async () => {
    setNotifications((list) => list.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await axios.put(`${backendUrl}/api/notifications/read-all`);
    } catch { refresh(); }
  }, [backendUrl, refresh]);

  const remove = useCallback(async (id) => {
    const target = notifications.find((n) => n._id === id);
    setNotifications((list) => list.filter((n) => n._id !== id));
    if (target && !target.isRead) setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await axios.delete(`${backendUrl}/api/notifications/${id}`);
    } catch { refresh(); }
  }, [backendUrl, notifications, refresh]);

  const clearAll = useCallback(async () => {
    setNotifications([]);
    setUnreadCount(0);
    try {
      await axios.delete(`${backendUrl}/api/notifications/clear-all`);
    } catch { refresh(); }
  }, [backendUrl, refresh]);

  const value = useMemo(
    () => ({ notifications, unreadCount, loading, error, refresh, markRead, markAllRead, remove, clearAll }),
    [notifications, unreadCount, loading, error, refresh, markRead, markAllRead, remove, clearAll]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
  return ctx;
};
