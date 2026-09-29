import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { BookOpen, CalendarClock, Gauge, AlertTriangle, Check } from "lucide-react";
import { useAuth } from "../pages/authentication/AuthContext";

const formatDue = (iso) => new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const formatShort = (iso) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });

// Preview before a shared task lands in your own list. Used for a typed 6-digit code and
// for the "Add to my schedule" button on a task in a group chat, so both behave the same:
// you see the details, whether you already have it, and what else is due around then.
//
//   tag         the 6-digit share tag
//   onImported  called with the new task once it's added
export default function TaskImportDialog({ tag, onClose, onImported }) {
  const { backendUrl } = useAuth();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    axios.get(`${backendUrl}/api/tasks/share/${tag}`, { withCredentials: true })
      .then(({ data }) => {
        if (cancelled) return;
        if (data.success) setPreview(data);
        else setError(data.message || "Couldn't find that task.");
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || "Couldn't open that task. Check your connection and try again.");
      });
    return () => { cancelled = true; };
  }, [backendUrl, tag]);

  const add = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${backendUrl}/api/tasks/import`, { shareTag: tag }, { withCredentials: true });
      if (data.success) {
        toast.success("Added to your tasks.");
        onImported(data.task);
      } else {
        setError(data.message || "Couldn't add that task.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't add that task. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const task = preview?.task;
  const nearbyHours = preview?.nearby.reduce((sum, t) => sum + (Number(t.hours) || 0), 0) ?? 0;
  const past = task && new Date(task.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal-content task-import" role="dialog" aria-modal="true" aria-labelledby="task-import-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="task-import-title">Add this task?</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {!task && !error && <p className="sched-hint">Opening the task...</p>}
        {error && <p className="form-error" role="alert">{error}</p>}

        {task && (
          <>
            <div className="task-import-card">
              <h3>{task.title}</h3>
              <p className="task-import-line"><BookOpen size={15} aria-hidden="true" /> {task.course}</p>
              <p className="task-import-line"><CalendarClock size={15} aria-hidden="true" /> Due {formatDue(task.dueDate)}</p>
              <p className="task-import-line"><Gauge size={15} aria-hidden="true" /> {task.hours}h estimated · difficulty {task.difficulty}/5 · importance {task.importance}/5</p>
              {task.description && <p className="task-import-desc">{task.description}</p>}
            </div>

            {preview.alreadyAdded && (
              <p className="task-import-note is-same"><Check size={16} aria-hidden="true" /> You already have this task, so there's nothing to add.</p>
            )}
            {past && !preview.alreadyAdded && (
              <p className="task-import-note is-warn"><AlertTriangle size={16} aria-hidden="true" /> The due date has already passed. It will show as overdue until you change the date.</p>
            )}
            {!preview.alreadyAdded && preview.nearby.length > 0 && (
              <div className="task-import-note is-warn">
                <AlertTriangle size={16} aria-hidden="true" />
                <div>
                  <strong>Busy around then.</strong> You already have {preview.nearby.length} {preview.nearby.length === 1 ? "task" : "tasks"}
                  {" "}due within a day{nearbyHours ? ` (${nearbyHours}h)` : ""}:
                  <ul>
                    {preview.nearby.map((t) => (
                      <li key={t._id}>{t.title} <span>due {formatShort(t.dueDate)}, {t.hours}h</span></li>
                    ))}
                  </ul>
                  You can still add it and change the details afterwards.
                </div>
              </div>
            )}
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>
            {preview?.alreadyAdded || error ? "Close" : "Cancel"}
          </button>
          {task && !preview.alreadyAdded && (
            <button type="button" className="primary-button" onClick={add} disabled={busy}>
              {busy ? "Adding..." : "Add task"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
