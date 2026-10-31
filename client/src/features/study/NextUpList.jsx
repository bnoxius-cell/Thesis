import { Card, Chip } from "@/shared/ui";
import { lower } from "@/features/plan/entryTime";
import { dueWords } from "@/shared/lib/dueChip";
import { shortDate } from "@/shared/lib/dates";
import { taskDueIso } from "@/utils/scheduleUtils";
import { daysUntilIso, examWords } from "./subjectClasses";

const MAX_ROWS = 5;
const SOON_DAYS = 3; // a due date this close turns its chip amber

const dueTone = (days) => (days < 0 ? "danger" : days <= SOON_DAYS ? "watch" : "neutral");

// One row of the list: what it is, when, and a chip that says how soon.
function rowFor({ kind, iso, task, entry }, now) {
  const days = daysUntilIso(iso, now);
  if (kind === "task") {
    return { title: task.title, meta: shortDate(iso), chip: { tone: dueTone(days), label: dueWords(task.dueDate, now) } };
  }
  const where = [lower(entry.startTime), entry.location].filter(Boolean).join(" · ");
  const meta = `${shortDate(iso)} · ${where}`;
  if (kind === "exam") return { title: entry.title, meta, chip: { tone: "watch", label: examWords(days) } };
  return { title: entry.title, meta, chip: { tone: "neutral", label: "Class" } };
}

// "Next up" (Figma 76:1062): the subject's open tasks and the classes and exams still to come this
// week in one list, soonest first, five rows at most. A row has no icon or tick (the frame has none);
// tasks are ticked off in Plan and on Home.
export default function NextUpList({ tasks, upcoming, now }) {
  const items = [
    ...tasks.map((task) => ({ kind: "task", key: task._id, iso: taskDueIso(task.dueDate), task })),
    ...upcoming.map(({ iso, entry }) => ({
      kind: entry.kind === "exam" ? "exam" : "class",
      key: `${iso}-${entry._id ?? `${entry.title}-${entry.startTime}`}`,
      iso,
      entry,
    })),
  ]
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .slice(0, MAX_ROWS);

  return (
    <Card as="section" className="subject-card" aria-labelledby="subject-next-title">
      <h2 id="subject-next-title" className="subject-card__title">Next up</h2>
      {items.length === 0 ? (
        <p className="subject-card__quiet">Nothing coming up. Enjoy the breathing room.</p>
      ) : (
        <ul className="subject-rows stagger">
          {items.map((item) => {
            const row = rowFor(item, now);
            return (
              <li key={item.key} className="subject-row">
                <span className="subject-row__text">
                  <strong className="subject-row__title">{row.title}</strong>
                  <span className="subject-row__meta">{row.meta}</span>
                </span>
                <Chip tone={row.chip.tone}>{row.chip.label}</Chip>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
