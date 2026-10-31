import { useId } from "react";
import { Chip } from "@/shared/ui";

// One titled group of the Tasks view: "Overdue 1", "Today 2 Thu, Oct 30". `tone` colours the count
// chip (Overdue red, Today accent, Done green, the rest neutral). Renders nothing when empty.
export default function TaskGroup({ title, count, tone = "neutral", note, children }) {
  const headingId = useId();
  if (count === 0) return null;
  return (
    <section className="plan-group" aria-labelledby={headingId}>
      <header className="plan-group__head">
        <h2 id={headingId} className="plan-group__title">{title}</h2>
        <Chip tone={tone}>{count}</Chip>
        {note && <span className="plan-group__note">{note}</span>}
      </header>
      <ul className="plan-group__rows">{children}</ul>
    </section>
  );
}
