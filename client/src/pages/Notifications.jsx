import { useState, useEffect } from "react";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import { useAuth } from "./authentication/AuthContext";
import "../App.css";

const STORAGE_KEY = "stresscare-notifications";

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState("all");
  const [clearConfirm, setClearConfirm] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setNotifications(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const saveNotifications = (newNotifications) => {
    setNotifications(newNotifications);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newNotifications));
  };

  const markAsRead = (id) => {
    const updated = notifications.map(notif =>
      notif.id === id ? { ...notif, read: true } : notif
    );
    saveNotifications(updated);
  };

  const markAllAsRead = () => {
    const updated = notifications.map(notif => ({ ...notif, read: true }));
    saveNotifications(updated);
  };

  const deleteOne = (id) => {
    saveNotifications(notifications.filter(n => n.id !== id));
  };

  const clearAllConfirmed = () => {
    saveNotifications([]);
    setClearConfirm(false);
  };

  const sendTestNotification = () => {
    const newNotif = {
      id: Date.now(),
      title: "Test notification",
      message: "This is a demo notification. Real alerts will come from task deadlines and group updates.",
      type: "info",
      read: false,
      timestamp: new Date().toISOString(),
    };
    saveNotifications([newNotif, ...notifications]);
  };

  const sendDueReminder = () => {
    const newNotif = {
      id: Date.now(),
      title: "Task due soon",
      message: "Your 'Capstone report' is due tomorrow. Plan your study time.",
      type: "deadline",
      read: false,
      timestamp: new Date().toISOString(),
    };
    saveNotifications([newNotif, ...notifications]);
  };

  const sendGroupUpdate = () => {
    const newNotif = {
      id: Date.now(),
      title: "Group task shared",
      message: "A new task was shared to 'CS50 Study Squad' group.",
      type: "group",
      read: false,
      timestamp: new Date().toISOString(),
    };
    saveNotifications([newNotif, ...notifications]);
  };

  const filteredNotifications = filter === "all"
    ? notifications
    : notifications.filter(n => !n.read);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="app app-layout">
      <Header />
      <main className="dashboard">
        <section className="hero" id="notifications-hero">
          <div className="hero-copy">
            <span className="eyebrow">Alerts & Updates</span>
            <h1>Stay on top of deadlines</h1>
            <p>
              Task due reminders and group activity will appear here. Keep your study flow uninterrupted.
            </p>
          </div>
          <aside className="hero-panel">
            <h2>Notification settings</h2>
            <ul className="hero-list">
              <li>Task deadline alerts</li>
              <li>Group task updates</li>
              <li>Reminders (optional email)</li>
              <li>Clear or mark as read</li>
            </ul>
          </aside>
        </section>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Inbox</span>
              <h2>Notifications {unreadCount > 0 && `(${unreadCount} unread)`}</h2>
            </div>
            <div className="notification-actions">
              <button className="secondary-button" onClick={markAllAsRead}>
                Mark all read
              </button>
              <button className="ghost-button" onClick={() => setClearConfirm(true)}>
                Clear all
              </button>
            </div>
          </div>

          <div className="notification-filter">
            <button
              className={filter === "all" ? "primary-button small" : "secondary-button small"}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            <button
              className={filter === "unread" ? "primary-button small" : "secondary-button small"}
              onClick={() => setFilter("unread")}
            >
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </button>
          </div>

          {filteredNotifications.length === 0 ? (
            <p className="schedule-empty">
              No notifications yet. Use the demo buttons below to see how they appear.
            </p>
          ) : (
            <div className="notifications-list">
              {filteredNotifications.map((notif) => (
                <div key={notif.id} className={`notification-card ${!notif.read ? "unread" : ""}`}>
                  <div className="notification-content">
                    <div className="notification-icon">
                      {notif.type === "deadline" && "⏰"}
                      {notif.type === "group" && "👥"}
                      {notif.type === "info" && "📌"}
                    </div>
                    <div className="notification-details">
                      <h4>{notif.title}</h4>
                      <p>{notif.message}</p>
                      <small>{new Date(notif.timestamp).toLocaleString()}</small>
                    </div>
                  </div>
                  <div className="notification-actions-card">
                    {!notif.read && (
                      <button className="mark-read-button" onClick={() => markAsRead(notif.id)}>
                        <svg className="done-svgIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </button>
                    )}
                    <button className="remove-button" onClick={() => deleteOne(notif.id)}>
                      <svg className="remove-svgIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Demo buttons */}
        <div className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Demo</span>
              <h2>Test notifications</h2>
            </div>
          </div>
          <p className="demo-note">
            These buttons are for demonstration. In the live system, notifications will appear automatically.
          </p>
          <div className="demo-buttons">
            <button className="secondary-button" onClick={sendTestNotification}>
              📢 Send test info
            </button>
            <button className="secondary-button" onClick={sendDueReminder}>
              ⏰ Simulate due reminder
            </button>
            <button className="secondary-button" onClick={sendGroupUpdate}>
              👥 Simulate group update
            </button>
          </div>
        </div>
      </main>

      {/* Custom confirm modal (exact design from user) */}
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
              <p className="card-description">This action cannot be undone. All notifications will be permanently removed.</p>
            </div>
            <div className="card-button-wrapper">
              <button className="card-button secondary" onClick={() => setClearConfirm(false)}>Cancel</button>
              <button className="card-button primary" onClick={clearAllConfirmed}>Clear all</button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
