import { useCallback, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Button, Skeleton } from "@/shared/ui";
import Page from "@/app/shell/Page";
import { useAuth } from "@/pages/authentication/AuthContext";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import useNow from "@/shared/hooks/useNow";
import { monthOfWeek, toISODate } from "@/utils/scheduleUtils";
import { profileFromUser } from "@/features/workload/useWorkload";
import useTaskDone from "@/features/tasks/useTaskDone";
import MonthGrid from "./MonthGrid";
import PhoneWeek from "./PhoneWeek";
import PlanControls from "./PlanControls";
import WeekGrid from "./WeekGrid";
import { buildMonthRows } from "./monthDays";
import { buildPlanDays } from "./planDays";
import TasksView from "./TasksView";
import TimetableSwitcher from "./TimetableSwitcher";
import { usePlanParams } from "./planParams";
import usePlanData from "./usePlanData";
import useMonthData from "./useMonthData";
import useTimetables from "./useTimetables";
import "./plan.css";

const DATE_FORMAT = { weekday: "long", month: "short", day: "numeric" };

const TIMETABLE_GONE = "That timetable isn't available anymore. It may have been deleted or is no longer shared with you.";

const MONTH_LABEL = { month: "long", year: "numeric" };

// Plan (Figma 38:3 desktop, 40:387 phone): the week's classes and tasks, as seven columns from 1024px
// and a day strip with one day's agenda below that. Month (38:234) is the month grid and Tasks
// (38:276) is every task in groups. The view, the week and the timetable live in the
// URL (planParams.js), so a reload or a shared link lands on the same screen.
export default function PlanPage() {
  const { userData } = useAuth();
  const now = useNow();
  const params = usePlanParams();
  const timetables = useTimetables();
  // A timetable that was deleted, made private or never existed sends the student back to My week.
  const setTimetable = params.setTimetable;
  const leaveTimetable = useCallback(() => {
    toast.error(TIMETABLE_GONE, { toastId: "plan-timetable-gone" });
    setTimetable(null);
  }, [setTimetable]);
  const view = params.view;
  // Month and Tasks always read the student's own plan; a timetable only applies to Week view.
  const data = usePlanData(params.weekStart, view === "week" ? params.timetable : null, leaveTimetable, view === "week");
  const month = monthOfWeek(params.weekStart);
  const monthData = useMonthData(month, view === "month");
  const setDone = useTaskDone(data.setTasks);
  // Which way the week was last stepped, so the new one slides in from that side.
  const [direction, setDirection] = useState("none");
  // The day the phone agenda shows; until one is tapped it follows today (or Monday in another week).
  const [pickedKey, setPickedKey] = useState(null);
  const sevenColumns = useMediaQuery("(min-width: 1024px)");

  const profile = useMemo(() => profileFromUser(userData), [userData]);
  const days = useMemo(
    () => buildPlanDays({
      weekStart: params.weekStart, overview: data.overview, tasks: data.tasks, subjectsById: data.subjectsById, profile, now,
    }),
    [params.weekStart, data.overview, data.tasks, data.subjectsById, profile, now],
  );

  // New key, new arrival: the grid eases in again when the week or the timetable changes.
  const weekKey = `${params.weekStart.getTime()}-${params.timetable ?? ""}`;
  const selected = days.find((day) => day.key === pickedKey) ?? days.find((day) => day.isToday) ?? days[0];
  const nothingPlanned = days.every((day) => !day.holiday && day.entries.length === 0 && day.tasks.length === 0);

  const monthRows = useMemo(
    () => buildMonthRows({ month, overviews: monthData.overviews, tasks: data.tasks, subjectsById: data.subjectsById, now }),
    [month, monthData.overviews, data.tasks, data.subjectsById, now],
  );

  // The arrows step by the unit of the open view.
  const shift = (steps) => {
    setDirection(steps > 0 ? "next" : "prev");
    if (view === "month") params.shiftMonth(steps);
    else params.shiftWeek(steps);
  };
  const openDay = (date) => {
    setPickedKey(toISODate(date));
    params.openWeek(date);
  };

  // The page waits for what the open view reads: tasks and subjects always, the month's weeks in Month.
  const failed = data.status === "failed" || (view === "month" && monthData.status === "failed");
  const loading = !failed && (data.status === "loading" || (view === "month" && monthData.status === "loading"));
  const ready = !loading && !failed;
  const retry = () => {
    if (data.status === "failed") data.reload();
    if (view === "month" && monthData.status === "failed") monthData.reload();
  };
  const goToday = () => {
    setDirection(params.weekStart > now ? "prev" : "next");
    setPickedKey(null);
    params.goToday();
  };

  return (
    <Page title="Plan" subtitle={now.toLocaleDateString("en-US", DATE_FORMAT)}>
      <PlanControls
        view={view}
        onView={params.setView}
        weekStart={params.weekStart}
        now={now}
        onShift={shift}
        onToday={goToday}
      >
        {view === "week" && (
          <TimetableSwitcher
            timetableId={params.timetable}
            timetables={timetables.timetables}
            status={timetables.status}
            onReload={timetables.reload}
            onPick={setTimetable}
          />
        )}
      </PlanControls>
      {loading && (
        <div role="status" aria-label="Loading your plan">
          <Skeleton className="plan-skeleton" height="480px" />
        </div>
      )}
      {failed && (
        <div className="plan-failed" role="alert">
          <p>{data.error || monthData.error}</p>
          <Button variant="secondary" onClick={retry}>Try again</Button>
        </div>
      )}
      {ready && view === "month" && (
        <MonthGrid
          key={month.getTime()}
          rows={monthRows}
          label={month.toLocaleDateString("en-US", MONTH_LABEL)}
          onOpen={openDay}
          direction={direction}
        />
      )}
      {ready && view === "tasks" && (
        <TasksView tasks={data.tasks} subjectsById={data.subjectsById} now={now} onToggle={setDone} />
      )}
      {ready && view === "week" && (
        <>
          {sevenColumns ? (
            <WeekGrid key={weekKey} days={days} now={now} onToggle={setDone} direction={direction} />
          ) : (
            <PhoneWeek
              key={weekKey}
              days={days}
              selected={selected}
              onSelect={setPickedKey}
              now={now}
              onToggle={setDone}
              direction={direction}
            />
          )}
          {data.holidayError && <p className="plan-quiet">{data.holidayError}</p>}
          {nothingPlanned && <p className="plan-quiet">Nothing is planned for this week yet.</p>}
        </>
      )}
    </Page>
  );
}
