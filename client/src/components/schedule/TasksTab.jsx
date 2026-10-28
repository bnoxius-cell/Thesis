import { useState } from "react";
import { ClipboardList, Download, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import ConfirmDialog from "../ConfirmDialog";
import EmptyState from "../EmptyState";
import Menu, { MenuItem } from "./Menu";
import { dueChip, taskEditLabel } from "../../utils/dueChip";
import useEnteringIds from "../../utils/useEnteringIds";
import QuickAddTask from "../QuickAddTask";
import TaskCheck from "../TaskCheck";
import { addDays, startOfWeek, taskDueIso, toISODate } from "../../utils/scheduleUtils";

function StudyPlan({ week, hasTasks }) {
  const [open, setOpen] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 721px)").matches);
  return (
    <details className="plan-disclosure" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Your study plan</summary>
      {!hasTasks ? (
        <p className="schedule-empty-state">Nothing planned yet. Once you add a task, your week fills in here.</p>
      ) : (
        <div className="schedule-stack">
          {week.map((day) => (
            <article className="schedule-day" key={day.key}>
              <div className="schedule-day-head">
                <strong>{day.label}</strong>
                <span>{day.load}h of {day.capacity}h</span>
              </div>
              <p className="schedule-date-label">{day.holiday ? `${day.dateLabel} · ${day.holiday}` : day.dateLabel}</p>
              {day.busyHours > 0 && <span className="schedule-busy">{day.busyHours}h of classes and activities</span>}
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
    </details>
  );
}

// The person's own tasks as compact rows: a round done box, title and course, a due chip, the
// hours, and a menu. The study plan sits beside them on a laptop and folds away on a phone.
export default function TasksTab({ tasks, week, now, onAdded, onMoreDetails, onUseCode, onEdit, onSetDone, onDelete }) {
  const [filter, setFilter] = useState("open");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [copied, setCopied] = useState("");
  const [manualCopy, setManualCopy] = useState("");

  const open = tasks
    .filter((t) => !t.isCompleted)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const done = tasks
    .filter((t) => t.isCompleted)
    .sort((a, b) => new Date(b.updatedAt || b.dueDate) - new Date(a.updatedAt || a.dueDate));
  const shown = filter === "open" ? open : done;
  const entering = useEnteringIds(shown.map((t) => t._id));

  // Open tasks in three groups by due day (the same UTC day the week view uses): overdue, the
  // rest of this Monday-to-Sunday week, and later. Empty groups are left out.
  const todayIso = toISODate(now);
  const weekEndIso = toISODate(addDays(startOfWeek(now), 6));
  const groups = [
    { id: "overdue", label: "Overdue", tasks: open.filter((t) => taskDueIso(t.dueDate) < todayIso) },
    { id: "week", label: "This week", tasks: open.filter((t) => { const d = taskDueIso(t.dueDate); return d >= todayIso && d <= weekEndIso; }) },
    { id: "later", label: "Later", tasks: open.filter((t) => taskDueIso(t.dueDate) > weekEndIso) },
  ].filter((g) => g.tasks.length > 0);

  const renderRow = (task) => {
    const chip = task.isCompleted ? null : dueChip(task.dueDate, now);
    return (
      <li key={task._id} className={`task-row${task.isCompleted ? " is-done" : ""}${entering.has(task._id) ? " is-entering" : ""}`}>
        <TaskCheck task={task} onChange={onSetDone} />
        <button type="button" className="task-row-body" onClick={() => onEdit(task)} aria-label={taskEditLabel(task, now)}>
          <strong>{task.title}</strong>
          <span className={task.course ? undefined : "is-empty"}>{[task.course || "No course", task.hours ? `${task.hours}h` : ""].filter(Boolean).join(" · ")}</span>
        </button>
        {chip && <span className={`chip is-${chip.tone}`}>{chip.label}</span>}
        <Menu trigger={<MoreHorizontal size={18} aria-hidden="true" />} label={`More for ${task.title}`} className="task-more">
          {(close) => (
            <>
              <MenuItem icon={Pencil} onClick={() => { close(); onEdit(task); }}>Edit</MenuItem>
              <MenuItem icon={Share2} hint={task.shareTag ? `Code ${task.shareTag}` : undefined} onClick={() => { close(); copyCode(task.shareTag); }}>
                {copied === task.shareTag ? "Copied" : "Copy share code"}
              </MenuItem>
              <MenuItem icon={Trash2} tone="danger" onClick={() => { close(); onDelete(task); }}>Delete</MenuItem>
            </>
          )}
        </Menu>
      </li>
    );
  };

  const submitCode = (event) => {
    event.preventDefault();
    const tag = code.trim();
    if (!/^\d{6}$/.test(tag)) {
      setCodeError("Enter the 6-digit share code.");
      return;
    }
    setCodeError("");
    setCode("");
    onUseCode(tag);
  };

  const copyCode = async (shareTag) => {
    if (!shareTag) return;
    try {
      await navigator.clipboard.writeText(shareTag);
      setCopied(shareTag);
      setTimeout(() => setCopied(""), 1600);
    } catch {
      setManualCopy(shareTag);
    }
  };

  return (
    <div className="tasks-tab" role="tabpanel" id="panel-tasks" aria-labelledby="tab-tasks">
      <section className="panel tasks-main" data-tour="sched-tasks">
        <QuickAddTask flat tour="sched-quick" onAdded={onAdded} onMoreDetails={onMoreDetails} />
        <div className="tasks-toolbar">
          <div className="segmented" role="group" aria-label="Show">
            <button type="button" className={`segmented-option${filter === "open" ? " is-selected" : ""}`} aria-pressed={filter === "open"} onClick={() => setFilter("open")}>Open ({open.length})</button>
            <button type="button" className={`segmented-option${filter === "done" ? " is-selected" : ""}`} aria-pressed={filter === "done"} onClick={() => setFilter("done")}>Done ({done.length})</button>
          </div>
        </div>

        <form className="task-import-form" onSubmit={submitCode}>
          <input
            id="task-import-code"
            type="text"
            inputMode="numeric"
            maxLength="6"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit share code"
            aria-label="Share code from a classmate"
          />
          <button type="submit" className="secondary-button"><Download size={16} aria-hidden="true" /> Add from code</button>
        </form>
        {codeError && <p className="task-message">{codeError}</p>}

        {shown.length === 0 ? (
          filter === "open" ? (
            <EmptyState icon={ClipboardList} title="No open tasks">
              Nothing to do right now. Add one above and your week will plan time for it.
            </EmptyState>
          ) : (
            <p className="task-list-empty">Finished tasks show up here.</p>
          )
        ) : filter === "open" ? (
          groups.map((group) => (
            <section key={group.id} className="task-group" aria-labelledby={`task-group-${group.id}`}>
              <h3 className={`task-group-title${group.id === "overdue" ? " is-overdue" : ""}`} id={`task-group-${group.id}`}>
                {group.label} <span>{group.tasks.length}</span>
              </h3>
              <ul className="task-rows">{group.tasks.map(renderRow)}</ul>
            </section>
          ))
        ) : (
          <ul className="task-rows">{shown.map(renderRow)}</ul>
        )}
      </section>

      <aside className="panel tasks-plan" data-tour="sched-plan">
        <StudyPlan week={week} hasTasks={open.length > 0} />
      </aside>

      <ConfirmDialog
        open={Boolean(manualCopy)}
        title="Copy this share code"
        confirmLabel="Done"
        cancelLabel={null}
        onConfirm={() => setManualCopy("")}
        onCancel={() => setManualCopy("")}
      >
        <p>Your browser didn't let us copy it. Select the code below and copy it yourself.</p>
        <input className="confirm-dialog-code" type="text" value={manualCopy} readOnly aria-label="Share code" onFocus={(e) => e.target.select()} />
      </ConfirmDialog>
    </div>
  );
}
