import { Plus } from "lucide-react";
import { Button, Card, Chip } from "@/shared/ui";
import { timeRangeText } from "@/features/plan/entryTime";
import JoinLink from "@/features/plan/JoinLink";
import { WEEKDAYS, fromISODate } from "@/utils/scheduleUtils";

const dayChips = (time) =>
  time.date
    ? [fromISODate(time.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })]
    : WEEKDAYS.filter((day) => time.days.includes(day.value)).map((day) => day.short);

// Where a class time lives, when it isn't on the main timetable: "On Org officers" for one the student can
// change, "From Org officers" for a shared one they can only look at.
const whereText = (time) => (time.isMain ? "" : `${time.canEdit ? "On" : "From"} ${time.scheduleTitle}`);

// "Class times" (Figma MS-2: desktop 405:793, empty 405:1082, phone 405:1113 and 405:1198): the subject's weekly
// class times from every timetable that counts in the student's week, one row each: the days, the hours, the
// room, a Join button when there is a meeting link, and Edit and Delete where the student may change it
// (a class time on a timetable shared with them can't be). `canAdd` is false for an archived subject.
export default function ClassTimesCard({ subject, classTimes, canAdd, onAdd, onEdit, onDelete }) {
  return (
    <Card as="section" className="subject-card class-times" aria-labelledby="class-times-title">
      <h2 id="class-times-title" className="subject-card__title">Class times</h2>
      {classTimes.length === 0 ? (
        <>
          <p className="subject-card__quiet">No class times yet. Add when {subject.name} meets and it shows on Plan too.</p>
          {canAdd && <Button className="class-times__start" onClick={onAdd}>Add a class time</Button>}
        </>
      ) : (
        <>
          <ul className="class-times__list">
            {classTimes.map((time) => {
              const where = whereText(time);
              const place = [time.location, where].filter(Boolean).join(" · ");
              return (
                <li key={`${time.scheduleId}-${time.entryId}`} className="class-time">
                  <span className="class-time__days">
                    {dayChips(time).map((name) => <Chip key={name}>{name}</Chip>)}
                  </span>
                  <span className="class-time__hours">{timeRangeText(time.startTime, time.endTime)}</span>
                  {place && <span className="class-time__place">{place}</span>}
                  <span className="class-time__actions">
                    {time.meetingUrl && <JoinLink entry={{ title: subject.name, meetingUrl: time.meetingUrl }} />}
                    {time.canEdit && (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => onEdit(time)} aria-label={`Edit ${dayChips(time).join(" and ")} class time`}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="class-time__delete" onClick={() => onDelete(time)} aria-label={`Delete ${dayChips(time).join(" and ")} class time`}>
                          Delete
                        </Button>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {canAdd && (
            <Button variant="ghost" icon={Plus} className="class-times__add" onClick={onAdd}>Add a class time</Button>
          )}
        </>
      )}
    </Card>
  );
}
