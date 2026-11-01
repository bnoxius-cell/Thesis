import { Button, Chip } from "@/shared/ui";

// One deadline in the Upcoming tab (Figma 64:618): the date, what it is, how near it is, and
// either "Add to my plan" or the quiet "In your plan" once it is there.
export default function UpcomingRow({ row, busy, onAdd }) {
  return (
    <li className="people-up-row">
      <div className="people-up-row__date">
        <span className="people-up-row__weekday">{row.weekday}</span>
        <span className="people-up-row__day">{row.day}</span>
      </div>
      <div className="people-up-row__text">
        <p className="people-up-row__title">{row.title}</p>
        <p className="people-up-row__sub">{row.sub}</p>
      </div>
      <div className="people-up-row__end">
        <Chip tone={row.chip.tone}>{row.chip.label}</Chip>
        {row.added ? (
          <Chip tone="good">In your plan</Chip>
        ) : (
          <Button
            variant="secondary"
            busy={busy}
            aria-label={`Add to my plan: ${row.title}`}
            onClick={() => onAdd(row.source)}
          >
            Add to my plan
          </Button>
        )}
      </div>
    </li>
  );
}
