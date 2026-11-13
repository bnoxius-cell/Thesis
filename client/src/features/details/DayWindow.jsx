import { CalendarDays, ChevronRight, Circle, Sun } from "lucide-react";
import { Button, Chip, EmptyState, Modal } from "@/shared/ui";
import { cheerLine } from "@/utils/cheerLine";
import { KIND_LABELS } from "@/utils/scheduleUtils";
import { dueWords } from "@/shared/lib/dueChip";
import ItemOpenButton from "./ItemOpenButton";
import { clock, daySummary, taskChip } from "./detailText";
import { planDayHref, taskSubject } from "./itemLinks";
import "./day-window.css";

const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1);

const KIND_TONE = { exam: "watch" };

// "2 hours", "1.5 hours": how long an exam runs.
function lengthText(hours) {
  const amount = Number(hours.toFixed(1));
  return `${amount} ${amount === 1 ? "hour" : "hours"}`;
}

// "Room 204 · until 9:30 am"; an exam says how long it runs instead.
function entryMeta(entry) {
  const when = entry.kind === "exam" ? lengthText(entry.hours) : `until ${clock(entry.endTime)}`;
  return [entry.location, when].filter(Boolean).join(" · ");
}

function DayRow({ lead, title, meta, chip, onOpen }) {
  return (
    <li className="day-row item-row">
      <span className="day-row__lead">{lead}</span>
      <div className="day-row__text">
        <p className="day-row__title">
          <ItemOpenButton onClick={onOpen}>{title}</ItemOpenButton>
        </p>
        <p className="day-row__meta">{meta}</p>
      </div>
      {chip && <Chip tone={chip.tone} className="day-row__chip">{chip.label}</Chip>}
      <ChevronRight size={20} aria-hidden="true" className="day-row__go" />
    </li>
  );
}

// The day window (Figma D9): one day in full. The date and how full it is, a day-off note, one cheer line,
// then the classes, exams and events ("Schedule") and the tasks due. A row opens that item's details window
// in its place, with a back arrow to here. `day` is a day from buildDay (features/plan/planDays.js).
// "Open this week" comes from `onOpenWeek` (when the page can show that week itself, like Plan's Month) or,
// with `weekLink`, a link into Plan; Plan's own week view passes neither, as it is already there. `still`
// keeps the scrim from fading in again when the window comes back from an item.
export default function DayWindow({ day, now, subjects, onClose, onOpenWeek, weekLink, still, returnFocusRef, onOpenEntry, onOpenTask }) {
  const empty = !day.holiday && day.entries.length === 0 && day.tasks.length === 0;
  const openWeek = onOpenWeek ? (
    <Button variant="secondary" onClick={() => { onClose(); onOpenWeek(); }}>Open this week</Button>
  ) : weekLink && (
    <Button variant="secondary" to={planDayHref(day.key, now)} onClick={onClose}>Open this week</Button>
  );

  return (
    <Modal
      title={day.label}
      subtitle={daySummary(day)}
      onClose={onClose}
      sheet
      className="item-detail day-window"
      overlayClassName={still ? "item-detail-swap" : undefined}
      actions={openWeek || undefined}
      returnFocusRef={returnFocusRef}
    >
      {day.holiday && (
        <p className="day-window__off">
          <CalendarDays size={16} aria-hidden="true" />
          {`${day.holiday}. No classes today.`}
        </p>
      )}
      <p className="day-window__cheer">
        <Sun size={20} aria-hidden="true" />
        {cheerLine(day)}
      </p>
      {empty && (
        <EmptyState icon={CalendarDays} title="Nothing on this day" titleAs="h3" className="day-window__empty">
          No classes, exams or tasks fall on it.
        </EmptyState>
      )}
      {day.entries.length > 0 && (
        <section className="day-window__section" aria-labelledby="day-window-schedule">
          <h3 id="day-window-schedule" className="day-window__eyebrow">Schedule</h3>
          <ul className="day-window__list">
            {day.entries.map((entry) => (
              <DayRow
                key={entry.id}
                lead={clock(entry.startTime)}
                title={entry.title}
                meta={entryMeta(entry)}
                chip={{ label: KIND_LABELS[entry.kind], tone: KIND_TONE[entry.kind] ?? "neutral" }}
                onOpen={() => onOpenEntry(entry, day.key)}
              />
            ))}
          </ul>
        </section>
      )}
      {day.tasks.length > 0 && (
        <section className="day-window__section" aria-labelledby="day-window-tasks">
          <h3 id="day-window-tasks" className="day-window__eyebrow">Tasks due</h3>
          <ul className="day-window__list">
            {day.tasks.map(({ task }) => (
              <DayRow
                key={task._id}
                lead={<Circle size={24} aria-hidden="true" />}
                title={task.title}
                meta={[taskSubject(task, subjects)?.name || task.course, lowerFirst(dueWords(task.dueDate, now))].filter(Boolean).join(" · ")}
                chip={taskChip(task, now)}
                onOpen={() => onOpenTask(task)}
              />
            ))}
          </ul>
        </section>
      )}
    </Modal>
  );
}
