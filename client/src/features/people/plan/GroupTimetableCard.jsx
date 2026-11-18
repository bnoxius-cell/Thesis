import { useState } from "react";
import { toast } from "react-toastify";
import { ArrowUpRight, CalendarDays, CalendarPlus, ListChecks } from "lucide-react";
import { Button, EmptyState, Switch } from "@/shared/ui";
import { createGroupTimetable } from "@/shared/api/groups";
import { updateMembership, updateTimetable } from "@/shared/api/schedules";
import { daysAgoText } from "@/shared/lib/dates";

const countLine = (count) => (count === 0 ? "Nothing on it yet." : `${count} ${count === 1 ? "item" : "items"} on it.`);

// The Group timetable section of the plan (Figma GW-1, GW-4 and the empty frames). With no timetable yet an
// admin can make one and a member is told an admin can; with one, the card says how much is on it and when it
// last changed, opens it in Plan (where admins edit and members look), and holds the "Count in my week" switch
// that adds it to the student's own week and workload (the owner changes the timetable's setting, anyone else
// their own membership), and "Change which classes I take", which reopens the join checklist (`onChangeClasses`).
// `timetable` is the summary from the plan; `onChanged` gets the summary after a change made here and
// `onReload` reads the plan again when the server disagrees (someone made it first).
export default function GroupTimetableCard({ groupId, timetable, canEdit, onChanged, onReload, onChangeClasses }) {
  const [busy, setBusy] = useState(false);

  const make = async () => {
    setBusy(true);
    const { data, error, status } = await createGroupTimetable(groupId);
    setBusy(false);
    if (data) return onChanged(data.timetable);
    toast.error(error);
    if (status === 409) onReload();
  };

  const toggleCount = async (counted) => {
    if (busy) return;
    setBusy(true);
    const { error } = timetable.role === "owner"
      ? await updateTimetable(timetable._id, { countInWorkload: counted })
      : await updateMembership(timetable._id, counted);
    setBusy(false);
    if (error) toast.error(error);
    else onChanged({ ...timetable, countInWorkload: counted });
  };

  let body;
  if (!timetable) {
    body = (
      <EmptyState
        titleAs="p"
        className="group-plan__empty"
        title="No group timetable yet"
        actions={canEdit && <Button variant="secondary" icon={CalendarPlus} busy={busy} onClick={make}>Make a group timetable</Button>}
      >
        {canEdit
          ? "Make one so every member can see the classes and pick the ones they take."
          : "An admin can add one. You will be able to choose which classes you take."}
      </EmptyState>
    );
  } else {
    const counted = busy ? !timetable.countInWorkload : timetable.countInWorkload; // flips at once, settles on the answer
    body = (
      <div className="group-tt">
        <div className="group-tt__top">
          <span className="group-tt__tile" aria-hidden="true"><CalendarDays size={20} /></span>
          <div className="group-tt__text">
            <p className="group-tt__title">{timetable.title}</p>
            <p className="group-tt__sub">
              {countLine(timetable.entryCount)} Last changed {daysAgoText(timetable.updatedAt).toLowerCase()}.
            </p>
          </div>
        </div>
        <Button variant="secondary" icon={ArrowUpRight} to={`/plan?timetable=${timetable._id}`}>Open in Plan</Button>
        <hr className="group-tt__divider" />
        <div className="group-tt__count">
          <Switch checked={counted} onChange={toggleCount} labelId="group-tt-count" describedBy="group-tt-count-hint" />
          <div className="group-tt__text">
            <p id="group-tt-count" className="group-tt__label">Count in my week</p>
            <p id="group-tt-count-hint" className="group-tt__sub">Adds the classes you take to your week and workload.</p>
          </div>
        </div>
        {timetable.entryCount > 0 && (
          <Button variant="ghost" icon={ListChecks} className="group-tt__classes" onClick={onChangeClasses}>
            Change which classes I take
          </Button>
        )}
      </div>
    );
  }

  return (
    <section className="group-section" aria-labelledby="group-tt-title">
      <h3 id="group-tt-title" className="group-section__title">Group timetable</h3>
      {body}
    </section>
  );
}
