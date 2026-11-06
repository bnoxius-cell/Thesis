import { Chip } from "@/shared/ui";
import TaskCheck from "@/features/tasks/TaskCheck";
import { lower } from "@/features/plan/entryTime";
import { dueWords } from "@/shared/lib/dueChip";
import { daysAgoText, shortDate } from "@/shared/lib/dates";
import { daysUntilIso, examWords } from "./subjectClasses";

const SOON_DAYS = 3; // a due date this close turns its chip amber

const dueTone = (days) => (days < 0 ? "danger" : days <= SOON_DAYS ? "watch" : "neutral");

// What a row says: a title, a line under it and, except on a done task, a chip that says how soon.
function rowFor({ kind, iso, task, entry }, now) {
  if (kind === "done") return { title: task.title, meta: `Done ${daysAgoText(task.completedAt, now).toLowerCase()}` };
  const days = daysUntilIso(iso, now);
  if (kind === "task") {
    return { title: task.title, meta: shortDate(iso), chip: { tone: dueTone(days), label: dueWords(task.dueDate, now) } };
  }
  const where = [lower(entry.startTime), entry.location].filter(Boolean).join(" · ");
  const meta = `${shortDate(iso)} · ${where}`;
  if (kind === "exam") return { title: entry.title, meta, chip: { tone: "watch", label: examWords(days) } };
  return { title: entry.title, meta, chip: { tone: "neutral", label: "Class" } };
}

// One row of a Subject list. `item.kind` is "task", "done" (a task ticked off this week), "exam" or
// "class". Task and done rows lead with the done box (TaskCheck); onToggle is useTaskDone's setDone.
export default function SubjectRow({ item, now, onToggle }) {
  const row = rowFor(item, now);
  const hasCheck = item.kind === "task" || item.kind === "done";
  return (
    <li className={`subject-row${hasCheck ? " subject-row--task" : ""}`}>
      {hasCheck && <TaskCheck task={item.task} onChange={onToggle} />}
      <span className="subject-row__text">
        <strong className="subject-row__title">{row.title}</strong>
        <span className="subject-row__meta">{row.meta}</span>
      </span>
      {row.chip && <Chip tone={row.chip.tone}>{row.chip.label}</Chip>}
    </li>
  );
}
