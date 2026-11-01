import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/shared/ui";
import { useAuth } from "@/pages/authentication/AuthContext";
import UpcomingRow from "./UpcomingRow";
import { buildUpcoming } from "./upcomingRows";
import useUpcoming from "./useUpcoming";
import "./people-upcoming.css";

function Section({ title, rows, addingId, onAdd }) {
  if (rows.length === 0) return null;
  return (
    <section className="people-up__section">
      <h3 className="people-up__eyebrow">{title}</h3>
      <ul className="people-up__list stagger">
        {rows.map((row) => (
          <UpcomingRow key={row.id} row={row} busy={addingId === row.id} onAdd={onAdd} />
        ))}
      </ul>
    </section>
  );
}

// The Upcoming tab (Figma 64:618): the deadlines this group's members have shared, split into this
// week and later, each one addable to the student's own plan.
export default function GroupUpcoming({ groupId }) {
  const { userData } = useAuth();
  const { deadlines, status, error, addingId, add, retry } = useUpcoming(groupId);
  const rows = useMemo(
    () => (deadlines ? buildUpcoming(deadlines, userData?._id) : null),
    [deadlines, userData?._id],
  );

  if (status === "loading") {
    return (
      <div className="people-up" role="status" aria-label="Loading deadlines">
        {[0, 1, 2].map((i) => <Skeleton key={i} height="76px" className="people-up__skeleton" />)}
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="people-up people-up--center" role="alert">
        <p className="people-up__failed">{error}</p>
        <Button variant="secondary" onClick={retry}>Try again</Button>
      </div>
    );
  }
  if (rows.week.length + rows.later.length === 0) {
    return (
      <EmptyState icon={CalendarClock} title="Nothing coming up" titleAs="p">
        Deadlines shared in this group will be listed here.
      </EmptyState>
    );
  }
  return (
    <div className="people-up">
      <Section title="This week" rows={rows.week} addingId={addingId} onAdd={add} />
      <Section title="Later" rows={rows.later} addingId={addingId} onAdd={add} />
    </div>
  );
}
