import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { CalendarClock, Check, Plus } from "lucide-react";
import { useAuth } from "../../pages/authentication/AuthContext";
import EmptyState from "../EmptyState";
import { dueChip } from "../../utils/dueChip";

const REFRESH_MS = 30000;

// "just now", "5 min ago", "3 hours ago", "2 days ago", then the date once it is over a week old.
function timeAgo(iso, now = new Date()) {
  const minutes = Math.round((now - new Date(iso)) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

// The deadlines people have shared in this group, soonest first. Every row can go straight into the
// reader's own tasks through the same preview dialog the chat card uses (`onAdd`). The list is fetched
// when the tab opens, again whenever `refreshKey` changes (a task was shared or added), and every 30s.
export default function GroupUpcoming({ groupId, refreshKey, onAdd, onShare }) {
  const { backendUrl, user } = useAuth();
  const myId = user?._id;
  const [deadlines, setDeadlines] = useState(null); // null until the first answer
  const [failed, setFailed] = useState(false);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const { data } = await axios.get(`${backendUrl}/api/groups/${groupId}/upcoming`, { withCredentials: true });
      if (data.success) {
        setDeadlines(data.deadlines);
        setFailed(false);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      busyRef.current = false;
    }
  }, [backendUrl, groupId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  if (deadlines === null) {
    return failed ? (
      <div className="upcoming-state">
        <p>Couldn't load the deadlines. Check your connection and try again.</p>
        <button type="button" className="secondary-button" onClick={load}>Try again</button>
      </div>
    ) : (
      <p className="upcoming-state" role="status">Loading deadlines...</p>
    );
  }

  const now = new Date();
  // The server keeps anything due in the last day, so a deadline from this morning is still there.
  // Hide whatever is before the reader's own today.
  const rows = deadlines
    .map((d) => ({ ...d, chip: dueChip(d.task.dueDate, now) }))
    .filter((d) => d.chip.days >= 0);

  if (rows.length === 0) {
    return (
      <div className="upcoming-empty">
        <EmptyState
          compact
          icon={CalendarClock}
          title="No deadlines shared yet"
          action={(
            <button type="button" className="secondary-button" onClick={onShare}>
              <Plus size={16} aria-hidden="true" /> Share a task
            </button>
          )}
        >
          Share one of your tasks so everyone sees it.
        </EmptyState>
      </div>
    );
  }

  return (
    <>
      {failed && <p className="upcoming-note" role="status">Couldn't refresh just now. Showing the last list.</p>}
      <ul className="upcoming-list">
        {rows.map((d) => {
          const { task, chip } = d;
          const sharer = d.sharedBy?._id === myId ? "you" : d.sharedBy?.name || "a former member";
          return (
            <li key={d._id} className="upcoming-row">
              <div className="upcoming-main">
                <strong>{task.title}</strong>
                <span>
                  {task.course ? `${task.course} · ` : ""}Shared by {sharer}, {timeAgo(d.sharedAt, now)}
                </span>
              </div>
              <span className={`chip is-${chip.tone}`}>
                <span className="sr-only">Due </span>{chip.label}
              </span>
              {d.addedByMe ? (
                <span className="chip is-good upcoming-added">
                  <Check size={14} aria-hidden="true" /> Added
                </span>
              ) : (
                <button
                  type="button"
                  className="secondary-button small upcoming-add"
                  onClick={() => onAdd(d)}
                >
                  <Plus size={16} aria-hidden="true" /> Add to my tasks<span className="sr-only">, {task.title}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
