import { useMemo } from "react";
import { Button, Skeleton } from "@/shared/ui";
import { useAuth } from "@/pages/authentication/AuthContext";
import UpcomingRow from "./UpcomingRow";
import { buildUpcoming } from "./upcomingRows";
import useUpcoming from "./useUpcoming";
import "./people-upcoming.css";

// The "Shared in chat" section of a group's Plan tab (Figma GW-1): the deadlines this group's members have
// posted in chat, soonest first, each addable to the student's own plan. They aren't part of the group plan.
export default function GroupUpcoming({ groupId }) {
  const { userData } = useAuth();
  const { deadlines, status, error, addingId, add, retry } = useUpcoming(groupId);
  const rows = useMemo(() => {
    if (!deadlines) return null;
    const { week, later } = buildUpcoming(deadlines, userData?._id);
    return [...week, ...later];
  }, [deadlines, userData?._id]);

  let body;
  if (status === "loading") {
    body = (
      <div className="people-up__list" role="status" aria-label="Loading deadlines">
        {[0, 1].map((i) => <Skeleton key={i} height="76px" className="people-up__skeleton" />)}
      </div>
    );
  } else if (status === "failed") {
    body = (
      <div className="people-up__failed" role="alert">
        <p>{error}</p>
        <Button variant="secondary" onClick={retry}>Try again</Button>
      </div>
    );
  } else if (rows.length === 0) {
    body = <p className="people-up__none">Nothing shared yet. Deadlines posted in chat will be listed here.</p>;
  } else {
    body = (
      <ul className="people-up__list">
        {rows.map((row) => (
          <UpcomingRow key={row.id} row={row} busy={addingId === row.id} onAdd={add} />
        ))}
      </ul>
    );
  }

  return (
    <section className="group-section" aria-labelledby="group-shared-title">
      <header className="group-section__titles">
        <h3 id="group-shared-title" className="group-section__title">Shared in chat</h3>
        <p className="group-section__sub">Deadlines groupmates posted in chat. They are not part of the group plan.</p>
      </header>
      {body}
    </section>
  );
}
