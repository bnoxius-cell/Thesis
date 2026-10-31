import { Clock } from "lucide-react";
import { Card, Chip } from "@/shared/ui";
import TaskCheck from "@/features/tasks/TaskCheck";
import { lower } from "@/features/plan/entryTime";
import { dueChip, dueWords } from "@/shared/lib/dueChip";
import { shortDate } from "@/shared/lib/dates";
import { taskDueIso } from "@/utils/scheduleUtils";

const MAX_ROWS = 5;

function TaskRow({ task, now, onToggle }) {
  return (
    <li className="subject-row">
      <TaskCheck task={task} onChange={onToggle} />
      <span className="subject-row__text">
        <strong className="subject-row__title">{task.title}</strong>
        <span className="subject-row__meta">{shortDate(taskDueIso(task.dueDate))}</span>
      </span>
      <Chip tone={dueChip(task.dueDate, now).tone}>{dueWords(task.dueDate, now)}</Chip>
    </li>
  );
}

function EntryRow({ iso, entry }) {
  const exam = entry.kind === "exam";
  const where = [lower(entry.startTime), entry.location].filter(Boolean).join(" · ");
  return (
    <li className="subject-row">
      <span className="subject-row__lead" aria-hidden="true"><Clock size={20} /></span>
      <span className="subject-row__text">
        <strong className="subject-row__title">{entry.title}</strong>
        <span className="subject-row__meta">{shortDate(iso)} · {where}</span>
      </span>
      <Chip tone={exam ? "watch" : "neutral"}>{exam ? "Exam" : "Class"}</Chip>
    </li>
  );
}

// "Next up" (Figma 76:1062): the subject's open tasks, soonest due first, then its classes and
// exams still to come this week, five rows at most. A task ticks off with the usual Undo toast and
// leaves the list. Rows keep their keys, so a tick doesn't replay the arrival.
export default function NextUpList({ tasks, upcoming, now, onToggle }) {
  const shownTasks = tasks.slice(0, MAX_ROWS);
  const shownEntries = upcoming.slice(0, MAX_ROWS - shownTasks.length);
  const empty = shownTasks.length + shownEntries.length === 0;

  return (
    <Card as="section" className="subject-card" aria-labelledby="subject-next-title">
      <h2 id="subject-next-title" className="subject-card__title">Next up</h2>
      {empty ? (
        <p className="subject-card__quiet">Nothing coming up. Enjoy the breathing room.</p>
      ) : (
        <ul className="subject-rows stagger">
          {shownTasks.map((task) => <TaskRow key={task._id} task={task} now={now} onToggle={onToggle} />)}
          {shownEntries.map(({ iso, entry }) => (
            <EntryRow key={`${iso}-${entry._id ?? `${entry.title}-${entry.startTime}`}`} iso={iso} entry={entry} />
          ))}
        </ul>
      )}
    </Card>
  );
}
