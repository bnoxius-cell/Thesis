import { useState } from "react";
import ConfirmDialog from "./ConfirmDialog";

function formatDays(daysLeft) {
  if (daysLeft < 0) return `${Math.abs(daysLeft)} day(s) overdue`;
  if (daysLeft === 0) return "Due today";
  if (daysLeft === 1) return "Due tomorrow";
  return `${daysLeft} days left`;
}

function toDateInputValue(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toISOString().split("T")[0];
}

function formatCreatedOn(dateString) {
  if (!dateString) return "Created date unavailable";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function TaskBoard({ tasks, schedule, onDeleteTask, onEditTask, onMarkDone }) {
  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    course: "",
    description: "",
    dueDate: "",
    hours: 3,
    difficulty: 3,
    importance: 3,
  });
  const [copiedCode, setCopiedCode] = useState("");
  // { kind: "done" | "delete", task }: asks before a task leaves the board.
  const [confirm, setConfirm] = useState(null);
  // Tag to show for copying by hand when the browser blocks the clipboard.
  const [manualCopy, setManualCopy] = useState("");

  const openEditModal = (task) => {
    setEditingTask(task);
    setEditForm({
      title: task.title,
      course: task.course,
      description: task.description || "",
      dueDate: toDateInputValue(task.dueDate),
      hours: task.hours,
      difficulty: task.difficulty,
      importance: task.importance,
    });
  };

  const closeEditModal = () => {
    setEditingTask(null);
  };

  const handleEditChange = (key, value) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (editingTask) {
      onEditTask(editingTask._id, editForm);
      closeEditModal();
    }
  };

  const copyTaskCode = async (shareTag) => {
    if (!shareTag) return;

    try {
      await navigator.clipboard.writeText(shareTag);
      setCopiedCode(shareTag);
      setTimeout(() => setCopiedCode(""), 1600);
    } catch {
      setManualCopy(shareTag);
    }
  };

  const handleConfirm = () => {
    if (confirm?.kind === "done") onMarkDone(confirm.task._id);
    if (confirm?.kind === "delete") onDeleteTask(confirm.task._id);
    setConfirm(null);
  };

  return (
    <>
      <div className="task-board">
        {/* TASK LIST */}
        <div className="task-list">
          {tasks.length === 0 && (
            <p className="task-list-empty">No tasks yet. Add one above to get started.</p>
          )}
          {tasks.map((task) => (
            <article className="task-card" key={task._id}>
              <div className="task-card-top">
                <div>
                  <span className={`status-pill ${task.status.toLowerCase().replace(/\s+/g, "-")}`}>
                    {task.status}
                  </span>
                  <h3>{task.title}</h3>
                  <p>{task.course}</p>
                  {task.description && <p className="task-description">{task.description}</p>}
                </div>

                <div className="task-actions">
                  {/* EDIT BUTTON */}
                  <button type="button" className="edit-button" onClick={() => openEditModal(task)} aria-label={`Edit ${task.title}`} title="Edit">
                    <svg className="edit-svgIcon" viewBox="0 0 512 512">
                      <path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"></path>
                    </svg>
                  </button>

                  {/* DONE BUTTON */}
                  <button type="button" className="done-button" onClick={() => setConfirm({ kind: "done", task })} aria-label={`Mark ${task.title} as done`} title="Mark as done">
                    <svg className="done-svgIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </button>

                  {/* REMOVE BUTTON (animated, with trash icon) */}
                  <button type="button" className="remove-button" onClick={() => setConfirm({ kind: "delete", task })} aria-label={`Delete ${task.title}`} title="Delete">
                    <svg className="remove-svgIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="task-meta">
                <span>{formatDays(task.daysLeft)}</span>
                <span>{task.hours} hrs est.</span>
                <span>{task.workload.toFixed(1)} score</span>
                <span>Created on: {formatCreatedOn(task.createdAt)}</span>
              </div>

              <div className="task-share-row">
                <span>Task tag: <strong>{task.shareTag}</strong></span>
                <button type="button" className="copy-code-button" onClick={() => copyTaskCode(task.shareTag)}>
                  {copiedCode === task.shareTag ? "Copied" : "Copy Tag"}
                </button>
              </div>

              <div className="task-progress">
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${Math.min(task.workload, 100)}%` }} />
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* SCHEDULE PANEL */}
        <aside className="schedule-panel">
          <h3>7-Day Study Plan</h3>
          {tasks.length === 0 ? (
            <p className="schedule-empty-state">Nothing scheduled yet. Once you add a task, your week fills in here.</p>
          ) : (
            <div className="schedule-stack">
              {schedule.map((day) => (
                <article className="schedule-day" key={day.key}>
                  <div className="schedule-day-head">
                    <strong>{day.label}</strong>
                    <span>{day.load}h of {day.capacity}h</span>
                  </div>
                  <p className="schedule-date-label">{day.holiday ? `${day.dateLabel} · ${day.holiday}` : day.dateLabel}</p>
                  {day.busyHours > 0 && (
                    <span className="schedule-busy">{day.busyHours}h of classes and activities</span>
                  )}
                  <div className="schedule-items">
                    {day.items.length ? (
                      day.items.map((item, index) => (
                        <div className="schedule-item" key={`${day.key}-${item.title}-${index}`}>
                          <span>{item.title}</span>
                          <strong>{item.hours}h</strong>
                        </div>
                      ))
                    ) : (
                      <div className="schedule-empty">Recovery block or review session</div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* EDIT MODAL (unchanged) */}
      {editingTask && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Task</h2>
              <button className="modal-close" onClick={closeEditModal}>×</button>
            </div>
            <form onSubmit={handleEditSubmit} className="form-grid">
              <div className="form-group">
                <label>Task Title *</label>
                <input type="text" value={editForm.title} onChange={(e) => handleEditChange("title", e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Course *</label>
                <input type="text" value={editForm.course} onChange={(e) => handleEditChange("course", e.target.value)} required />
              </div>
              <div className="form-group full-span">
                <label>Description</label>
                <textarea rows="4" value={editForm.description} onChange={(e) => handleEditChange("description", e.target.value)} />
              </div>
              <div className="form-group">
                <label>Due Date *</label>
                <input type="date" value={editForm.dueDate} onChange={(e) => handleEditChange("dueDate", e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Estimated Hours</label>
                <input type="number" min="0.5" step="0.5" value={editForm.hours} onChange={(e) => handleEditChange("hours", Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Difficulty (1-5): {editForm.difficulty}</label>
                <input type="range" min="1" max="5" value={editForm.difficulty} onChange={(e) => handleEditChange("difficulty", Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Importance (1-5): {editForm.importance}</label>
                <input type="range" min="1" max="5" value={editForm.importance} onChange={(e) => handleEditChange("importance", Number(e.target.value))} />
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={closeEditModal}>Cancel</button>
                <button type="submit" className="btn-create-task" style={{ width: "auto" }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.kind === "delete" ? "Delete this task?" : "Mark this task as done?"}
        confirmLabel={confirm?.kind === "delete" ? "Delete" : "Mark as done"}
        tone={confirm?.kind === "delete" ? "danger" : "default"}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      >
        {confirm?.kind === "done" && (
          <p><strong>{confirm.task.title}</strong> moves off your board and stops counting toward your week.</p>
        )}
        {confirm?.kind === "delete" && (
          <p><strong>{confirm.task.title}</strong> will be deleted, and your plan won't count it anymore. This can't be undone.</p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(manualCopy)}
        title="Copy this task tag"
        confirmLabel="Done"
        cancelLabel={null}
        onConfirm={() => setManualCopy("")}
        onCancel={() => setManualCopy("")}
      >
        <p>Your browser didn't let us copy it. Select the tag below and copy it yourself.</p>
        <input
          className="confirm-dialog-code"
          type="text"
          value={manualCopy}
          readOnly
          aria-label="Task tag"
          onFocus={(e) => e.target.select()}
        />
      </ConfirmDialog>
    </>
  );
}
