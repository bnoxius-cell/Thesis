import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, CalendarDays, ClipboardList, Clock, MessageSquare, UserCheck, UserPlus, Users,
} from "lucide-react";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import NotificationPreferences from "../components/NotificationPreferences";
import { useNotifications } from "../context/NotificationContext";
import "../App.css";

const ICONS = {
  friend_request: UserPlus,
  friend_accepted: UserCheck,
  group_message: MessageSquare,
  group_task: ClipboardList,
  group_schedule: CalendarDays,
  group_member: Users,
  group_invite: Users,
  task_reminder: Clock,
  schedule_share: CalendarDays,
  system: Bell,
};

const isGroupType = (type) => type.startsWith("group_");

const timeAgo = (iso) => {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return new Date(iso).toLocaleDateString();
};

export default function Notifications() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, error, refresh, markRead, markAllRead, remove, clearAll } = useNotifications();
  const [filter, setFilter] = useState("all");
  const [clearConfirm, setClearConfirm] = useState(false);

  const visible = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    if (filter === "groups") return isGroupType(n.type);
    return true;
  });

  const open = (n) => {
    markRead(n._id);
    if (n.link) navigate(n.link);
  };

  const confirmClear = () => {
    clearAll();
    setClearConfirm(false);
  };

  const emptyText = {
    all: "You're all caught up. New activity from your groups, friends and deadlines will show up here.",
    unread: "Nothing unread. Nice.",
    groups: "No group activity yet.",
  }[filter];

  return (
    <div className="app app-layout">
      <Header />
      <main className="dashboard">
        <section className="hero" id="notifications-hero">
          <div className="hero-copy">
            <span className="eyebrow">Alerts & Updates</span>
            <h1>Stay on top of things</h1>
            <p>
              Deadline reminders, group activity and friend updates land here. Choose what you hear about
              below, and turn on device alerts to get them on your phone or computer even when StressCare is closed.
            </p>
          </div>
          <aside className="hero-panel">
            <h2>{unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}</h2>
            <ul className="hero-list">
              <li>Task deadline reminders</li>
              <li>Group chat and shared tasks</li>
              <li>Friend requests and shared schedules</li>
            </ul>
            <a className="secondary-button small" href="#notification-settings">Notification settings</a>
          </aside>
        </section>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Inbox</span>
              <h2>Notifications {unreadCount > 0 && `(${unreadCount} unread)`}</h2>
            </div>
            <div className="notification-actions">
              <button className="secondary-button" onClick={markAllRead} disabled={unreadCount === 0}>
                Mark all read
              </button>
              <button className="ghost-button" onClick={() => setClearConfirm(true)} disabled={notifications.length === 0}>
                Clear all
              </button>
            </div>
          </div>

          <div className="notification-filter">
            {[
              ["all", "All"],
              ["unread", `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}`],
              ["groups", "Groups"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={filter === key ? "primary-button small" : "secondary-button small"}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="schedule-empty">Loading your notifications...</p>
          ) : error && notifications.length === 0 ? (
            <p className="schedule-empty">
              {error} <button className="ghost-button small" onClick={refresh}>Try again</button>
            </p>
          ) : visible.length === 0 ? (
            <p className="schedule-empty">{emptyText}</p>
          ) : (
            <div className="notifications-list">
              {visible.map((n) => {
                const Icon = ICONS[n.type] || Bell;
                return (
                  <div key={n._id} className={`notification-card ${!n.isRead ? "unread" : ""}`}>
                    <button type="button" className="notification-content notification-open" onClick={() => open(n)}>
                      <span className="notification-icon"><Icon size={20} /></span>
                      <span className="notification-details">
                        <h4>{n.title || "StressCare"}</h4>
                        <p>{n.message}</p>
                        <small>{timeAgo(n.activityAt || n.createdAt)}</small>
                      </span>
                    </button>
                    <div className="notification-actions-card">
                      {!n.isRead && (
                        <button className="mark-read-button" onClick={() => markRead(n._id)} title="Mark as read" aria-label="Mark as read">
                          <svg className="done-svgIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </button>
                      )}
                      <button className="remove-button" onClick={() => remove(n._id)} title="Delete" aria-label="Delete notification">
                        <svg className="remove-svgIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <NotificationPreferences />
      </main>

      {clearConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-card">
            <button className="exit-button" onClick={() => setClearConfirm(false)}>
              <svg height="20px" viewBox="0 0 384 512">
                <path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z" />
              </svg>
            </button>
            <div className="card-content">
              <p className="card-heading">Clear all notifications?</p>
              <p className="card-description">This can't be undone. Everything in your inbox will be removed.</p>
            </div>
            <div className="card-button-wrapper">
              <button className="card-button secondary" onClick={() => setClearConfirm(false)}>Cancel</button>
              <button className="card-button primary" onClick={confirmClear}>Clear all</button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
