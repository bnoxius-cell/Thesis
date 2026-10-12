import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell, CalendarDays, Check, CheckCheck, ClipboardList, Clock, MoreHorizontal, Settings, Trash2,
  MessageSquare, UserCheck, UserPlus, Users,
} from "lucide-react";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import PageHeader from "../components/PageHeader";
import Tabs from "../components/Tabs";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import Menu, { MenuItem } from "../components/schedule/Menu";
import { useAuth } from "./authentication/AuthContext";
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
  schedule_change: CalendarDays,
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

const stamp = (n) => n.activityAt || n.createdAt;
const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications, unreadCount, loading, error, refresh, markRead, markAllRead, remove, clearAll } = useNotifications();
  const [filter, setFilter] = useState("all");
  const [clearConfirm, setClearConfirm] = useState(false);

  const visible = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    if (filter === "groups") return isGroupType(n.type);
    return true;
  });
  const groups = [
    ["Today", visible.filter((n) => isToday(stamp(n)))],
    ["Earlier", visible.filter((n) => !isToday(stamp(n)))],
  ].filter(([, items]) => items.length > 0);

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
    unread: "Nothing unread.",
    groups: "No group activity yet.",
  }[filter];

  return (
    <div className="app app-layout">
      <Header />
      <main className="dashboard">
        <PageHeader
          title="Notifications"
          description={unreadCount > 0 ? `${unreadCount} unread. Deadline reminders, group activity and friend updates land here.` : "You're all caught up. Deadline reminders, group activity and friend updates land here."}
          actions={(
            <>
              <button type="button" className="secondary-button" onClick={markAllRead} disabled={unreadCount === 0}>
                <CheckCheck size={16} aria-hidden="true" /> Mark all read
              </button>
              <Link to={`/profile/${user?._id || ""}#notifications`} className="ghost-button">
                <Settings size={16} aria-hidden="true" /> Settings
              </Link>
              <Menu
                className="ghost-button icon-only"
                label="More actions"
                trigger={<MoreHorizontal size={18} aria-hidden="true" />}
              >
                {(close) => (
                  <MenuItem
                    icon={Trash2}
                    tone="danger"
                    disabled={notifications.length === 0}
                    onClick={() => { close(); setClearConfirm(true); }}
                  >
                    Clear all
                  </MenuItem>
                )}
              </Menu>
            </>
          )}
        />

        <Tabs
          label="Filter notifications"
          tabs={[
            { id: "all", label: "All" },
            { id: "unread", label: "Unread", count: unreadCount },
            { id: "groups", label: "Groups" },
          ]}
          value={filter}
          onChange={setFilter}
        />

        <div role="tabpanel" id={`panel-${filter}`} aria-labelledby={`tab-${filter}`} className="notice-panel">
          {loading ? (
            <p className="schedule-empty">Loading your notifications...</p>
          ) : error && notifications.length === 0 ? (
            <p className="schedule-empty">
              {error} <button type="button" className="ghost-button small" onClick={refresh}>Try again</button>
            </p>
          ) : visible.length === 0 ? (
            <EmptyState icon={Bell} title={filter === "all" ? "Nothing yet" : "Nothing here"}>{emptyText}</EmptyState>
          ) : (
            groups.map(([label, items]) => (
              <section key={label} className="notice-group" aria-label={label}>
                <h2 className="notice-group-title">{label}</h2>
                <ul className="notice-list">
                  {items.map((n) => {
                    const Icon = ICONS[n.type] || Bell;
                    return (
                      <li key={n._id} className={`notice${!n.isRead ? " is-unread" : ""}`}>
                        <button type="button" className="notice-open" onClick={() => open(n)}>
                          <span className="notice-dot" aria-hidden="true" />
                          <span className="notice-icon" aria-hidden="true"><Icon size={18} /></span>
                          <span className="notice-text">
                            <strong>{n.title || "StressCare"}{!n.isRead && <span className="visually-hidden"> (unread)</span>}</strong>
                            <span>{n.message}</span>
                            <small>{timeAgo(stamp(n))}</small>
                          </span>
                        </button>
                        <div className="notice-actions">
                          {!n.isRead && (
                            <button type="button" className="icon-action" onClick={() => markRead(n._id)} title="Mark as read" aria-label="Mark as read">
                              <Check size={18} aria-hidden="true" />
                            </button>
                          )}
                          <button type="button" className="icon-action is-danger" onClick={() => remove(n._id)} title="Delete" aria-label="Delete notification">
                            <Trash2 size={18} aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      </main>

      <ConfirmDialog
        open={clearConfirm}
        title="Clear all notifications?"
        confirmLabel="Clear all"
        tone="danger"
        onConfirm={confirmClear}
        onCancel={() => setClearConfirm(false)}
      >
        <p>Everything in your inbox will be removed. This can't be undone.</p>
      </ConfirmDialog>

      <Footer />
    </div>
  );
}
