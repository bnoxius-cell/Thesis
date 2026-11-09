import { Chip } from "@/shared/ui";
import ItemOpenButton from "@/features/details/ItemOpenButton";
import JoinLink from "./JoinLink";
import { timeRange } from "./entryTime";

const KIND_CHIP = { exam: "Exam", event: "Event" };

// One class, exam or event on a day: its time, title and room. Classes sit on their subject's tone
// with a bar down the left edge; an exam has an outline and a chip. Join shows only when the entry
// has a meeting link. `entry` comes from planDays (it carries `tone` and `hours`) and is on day `iso`; the
// title opens its details window through `onOpen(entry, iso)`.
export default function EntryBlock({ entry, iso, onOpen }) {
  const isExam = entry.kind === "exam";
  const chip = KIND_CHIP[entry.kind];
  return (
    <li
      className={`plan-entry item-row plan-entry--${isExam ? "exam" : entry.tone}`}
      style={{ "--hours": entry.hours }}
    >
      {!isExam && <span className="plan-entry__bar" aria-hidden="true" />}
      <div className="plan-entry__text">
        <p className="plan-entry__time">{timeRange(entry.startTime, entry.endTime)}</p>
        <p className="plan-entry__title">
          <ItemOpenButton onClick={() => onOpen(entry, iso)}>{entry.title}</ItemOpenButton>
        </p>
        {entry.location && <p className="plan-entry__time">{entry.location}</p>}
        {chip && <Chip tone={isExam ? "watch" : "neutral"} className="plan-entry__chip">{chip}</Chip>}
        {entry.meetingUrl && <JoinLink entry={entry} />}
      </div>
    </li>
  );
}
