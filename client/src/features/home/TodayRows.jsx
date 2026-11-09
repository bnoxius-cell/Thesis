import { MapPin } from "lucide-react";
import { Chip } from "@/shared/ui";
import TaskCheck from "@/features/tasks/TaskCheck";
import ItemOpenButton from "@/features/details/ItemOpenButton";
import { dueChip, dueWords } from "@/shared/lib/dueChip";
import { effortLabel } from "@/shared/lib/effort";
import { subjectTone } from "@/shared/lib/subjectTone";
import { formatTime, meetingProvider } from "@/utils/scheduleUtils";

const KIND_CHIP = { exam: { label: "Exam", tone: "watch" }, event: { label: "Event", tone: "neutral" } };

// A class, exam or event on today's timetable: a start-time chip (not on a live one), then Join when the
// entry has a meeting link (Figma 16:54). The title opens its details window through `onOpen`.
export function EntryRow({ entry, live, onOpen }) {
  const kind = KIND_CHIP[entry.kind];
  const provider = entry.meetingUrl ? meetingProvider(entry.meetingUrl) : null;
  return (
    <li className="home-row item-row">
      <span className="home-dot home-dot--accent" aria-hidden="true" />
      <div className="home-row__text">
        <strong className="home-row__title">
          <ItemOpenButton onClick={() => onOpen(entry)}>{entry.title}</ItemOpenButton>
        </strong>
        <span className="home-row__meta">
          {live ? "On now" : `${formatTime(entry.startTime)} to ${formatTime(entry.endTime)}`}
          {entry.location && (
            <>
              <span aria-hidden="true"> · </span>
              <MapPin size={13} aria-hidden="true" />
              {entry.location}
            </>
          )}
        </span>
      </div>
      <div className="home-row__end">
        {kind && <Chip tone={kind.tone}>{kind.label}</Chip>}
        {!live && <Chip tone="neutral">{formatTime(entry.startTime)}</Chip>}
        {entry.meetingUrl && (
          <a
            className="ui-btn ui-btn--primary"
            href={entry.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Join ${entry.title}${provider?.name ? ` on ${provider.name}` : ""}`}
          >
            <span>Join</span>
          </a>
        )}
      </div>
    </li>
  );
}

// A task due today or overdue, with its done box. The chip says how big it is; overdue ones turn it red.
// The title opens its details window through `onOpen`.
export function TaskRow({ task, subject, now, onToggle, onOpen }) {
  const overdue = dueChip(task.dueDate, now).tone === "danger";
  return (
    <li className="home-row item-row">
      <TaskCheck task={task} onChange={onToggle} />
      <div className="home-row__text">
        <strong className="home-row__title">
          <ItemOpenButton onClick={() => onOpen(task)}>{task.title}</ItemOpenButton>
        </strong>
        <span className="home-row__meta">
          {task.course && (
            <>
              <span className={`home-dot home-dot--${subjectTone(subject?.color)} home-dot--small`} aria-hidden="true" />
              {task.course}
              <span aria-hidden="true"> · </span>
            </>
          )}
          {dueWords(task.dueDate, now)}
        </span>
      </div>
      <div className="home-row__end">
        <Chip tone={overdue ? "danger" : "neutral"}>{effortLabel(task.hours)}</Chip>
      </div>
    </li>
  );
}
