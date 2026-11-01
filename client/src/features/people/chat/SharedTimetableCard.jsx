import { CalendarDays } from "lucide-react";
import { Button, Chip } from "@/shared/ui";
import useAddTimetable from "../useAddTimetable";

const countLabel = (entries) => {
  const word = entries.every((e) => e.kind === "class") ? ["class", "classes"] : ["entry", "entries"];
  return `${entries.length} ${entries.length === 1 ? word[0] : word[1]}`;
};

// A timetable someone posted in the chat (Figma 64:302): its name, how much is in it, and "Add to
// my plan", which copies it into the reader's own timetable. The sender's own card has no button.
//   plan   { groupId, onAdded } from the group view
export default function SharedTimetableCard({ message, mine, sender, plan }) {
  const { schedule } = message;
  const entries = schedule.entries ?? [];
  const { busy, add } = useAddTimetable(plan.groupId, message, plan.onAdded);
  const by = mine ? "you" : sender?.name ?? schedule.ownerName ?? "someone";

  return (
    <div className={`people-card ${message.fresh ? "is-entering" : ""}`.trim()}>
      <div className="people-card__top">
        <span className="people-card__icon">
          <CalendarDays size={20} aria-hidden="true" />
        </span>
        <div className="people-card__text">
          <p className="people-card__title">{schedule.title}</p>
          <p className="people-card__sub">{countLabel(entries)}, shared by {by}</p>
        </div>
      </div>
      {message.addedByMe && <Chip tone="good" className="people-card__done">In your plan</Chip>}
      {!message.addedByMe && !mine && (
        <Button variant="secondary" busy={busy} onClick={add} aria-label={`Add to my plan: ${schedule.title}`}>
          Add to my plan
        </Button>
      )}
    </div>
  );
}
