import { ChangeNotice, useTimetableEntries } from "@/features/plan/shared";

// The banners at the top of the Plan tab for classes the student customized and the group then changed or
// removed (Figma GW-7, desktop 385:2980, phone 385:4094). Each says what moved when it can (it reads the group's
// timetable and the student's own copies), and offers "Use the group's" or "Remove mine" (both ask first) and
// "Keep mine". The plan itself is read again by `choice`'s `onChanged`, which makes the banner go.
//   timetable  the plan's summary of the group timetable
//   classes    the plan's `myClasses.classes`
//   choice     useClassChoice
export default function GroupNotices({ timetable, classes, choice }) {
  const notices = classes.filter((item) => item.notice);
  const copySchedules = notices.flatMap((item) => (item.copy ? [item.copy.scheduleId] : []));
  const { entries } = useTimetableEntries(notices.length ? [timetable._id, ...copySchedules] : [], timetable.updatedAt);

  if (notices.length === 0) return null;
  return (
    <div className="group-notices">
      {notices.map((item) => {
        const ref = { scheduleId: timetable._id, entryId: item.entryId, title: item.title };
        return (
          <ChangeNotice
            key={item.entryId}
            inline
            notice={item.notice}
            title={item.title}
            shared={entries.get(item.entryId)}
            mine={item.copy && entries.get(item.copy.entryId)}
            busy={choice.busy}
            onResolve={() => choice.ask(item.notice === "changed" ? "use" : "remove", ref)}
            onKeep={() => choice.keepMine(ref)}
          />
        );
      })}
    </div>
  );
}
