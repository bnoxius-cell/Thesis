import { Plus, Video } from "lucide-react";
import { Button, Card, Chip } from "@/shared/ui";
import ItemOpenButton from "@/features/details/ItemOpenButton";
import { timeRangeText } from "@/features/plan/entryTime";
import JoinLink from "@/features/plan/JoinLink";
import { WEEKDAYS, entryOccursOn, fromISODate, toISODate } from "@/utils/scheduleUtils";
import { whereText } from "@/utils/classHero";

// The days a class time happens on as chips: the weekday names, or the date of a one-off. `today` marks the chip
// for today when the class time really happens today.
function dayChips(time, now) {
  const todayIso = toISODate(now);
  if (time.date) {
    const label = fromISODate(time.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return [{ label, today: time.date === todayIso }];
  }
  const happensToday = entryOccursOn(time, todayIso);
  return WEEKDAYS.filter((day) => time.days.includes(day.value)).map((day) => ({
    label: day.short,
    today: happensToday && day.value === now.getDay(),
  }));
}

// "Class times" (Figma OV-F1 430:889 and 442:4769): the subject's weekly class times from every timetable that
// counts in the student's week, one row each: the days (today's filled), the hours, the room, a Join button when
// there is a meeting link, and Edit and Delete where the student may change it (a class time on a timetable shared
// with them can't be). The whole row opens the details window (`onOpen`); Join, Edit and Delete are their own
// buttons. A class time with a different time on each day is stored as one entry per distinct time, so it shows
// as one row each. Not drawn when the subject has no class times (the hero asks for the first one). `canAdd` is
// false for an archived subject.
export default function ClassTimes({ subject, classTimes, now, canAdd, onAdd, onOpen, onEdit, onDelete }) {
  return (
    <Card as="section" className="subject-card class-times" aria-labelledby="class-times-title">
      <h2 id="class-times-title" className="subject-card__title">Class times</h2>
      <ul className="class-times__list stagger">
        {classTimes.map((time) => {
          const chips = dayChips(time, now);
          const names = chips.map((chip) => chip.label).join(" and ");
          const hours = timeRangeText(time.startTime, time.endTime);
          const where = whereText(time);
          const place = [time.location, where].filter(Boolean).join(" · ");
          return (
            <li key={`${time.scheduleId}-${time.entryId}`} className="class-time item-row">
              <div className="class-time__when">
                <span className="class-time__days">
                  {chips.map((chip) => <Chip key={chip.label} className={chip.today ? "class-time__today" : ""}>{chip.label}</Chip>)}
                </span>
                <span className="class-time__hours">
                  <ItemOpenButton onClick={() => onOpen(time)} aria-label={`${names} class time, ${hours}: details`}>
                    {hours}
                  </ItemOpenButton>
                </span>
              </div>
              <div className="class-time__rest">
                {place && <span className="class-time__place">{place}</span>}
                <span className="class-time__actions">
                  {time.meetingUrl && (
                    <JoinLink entry={{ title: subject.name, meetingUrl: time.meetingUrl }} icon={Video} className="class-time__join" />
                  )}
                  {time.canEdit && (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => onEdit(time)} aria-label={`Edit ${names} class time`}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="class-time__delete" onClick={() => onDelete(time)} aria-label={`Delete ${names} class time`}>
                        Delete
                      </Button>
                    </>
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {canAdd && (
        <Button variant="ghost" icon={Plus} className="class-times__add" onClick={onAdd}>Add a class time</Button>
      )}
    </Card>
  );
}
