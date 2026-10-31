import { useMemo, useState } from "react";
import { CalendarDays, ListChecks } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/shared/ui";
import Page from "@/app/shell/Page";
import { useAuth } from "@/pages/authentication/AuthContext";
import useNow from "@/shared/hooks/useNow";
import { profileFromUser } from "@/features/workload/useWorkload";
import useTaskDone from "@/features/tasks/useTaskDone";
import PlanControls from "./PlanControls";
import WeekGrid from "./WeekGrid";
import { buildPlanDays } from "./planDays";
import { usePlanParams } from "./planParams";
import usePlanWeek from "./usePlanWeek";
import "./plan.css";

const DATE_FORMAT = { weekday: "long", month: "short", day: "numeric" };

const COMING = {
  month: { icon: CalendarDays, text: "The month view is coming soon. Your classes and tasks are in Week view for now." },
  tasks: { icon: ListChecks, text: "The task list is coming soon. Your tasks sit under their due day in Week view for now." },
};

// Plan (Figma 38:3): the week's classes and tasks. The view, the week and the timetable live in the
// URL (planParams.js), so a reload or a shared link lands on the same screen.
export default function PlanPage() {
  const { userData } = useAuth();
  const now = useNow();
  const params = usePlanParams();
  const data = usePlanWeek(params.weekStart);
  const setDone = useTaskDone(data.setTasks);
  // Which way the week was last stepped, so the new one slides in from that side.
  const [direction, setDirection] = useState("none");

  const profile = useMemo(() => profileFromUser(userData), [userData]);
  const days = useMemo(
    () => buildPlanDays({
      weekStart: params.weekStart, overview: data.overview, tasks: data.tasks, subjectsById: data.subjectsById, profile, now,
    }),
    [params.weekStart, data.overview, data.tasks, data.subjectsById, profile, now],
  );

  const nothingPlanned = days.every((day) => !day.holiday && day.entries.length === 0 && day.tasks.length === 0);

  const shiftWeek = (weeks) => {
    setDirection(weeks > 0 ? "next" : "prev");
    params.shiftWeek(weeks);
  };
  const goToday = () => {
    setDirection(params.weekStart > now ? "prev" : "next");
    params.goToday();
  };

  return (
    <Page title="Plan" subtitle={now.toLocaleDateString("en-US", DATE_FORMAT)}>
      <PlanControls
        view={params.view}
        onView={params.setView}
        weekStart={params.weekStart}
        now={now}
        onShift={shiftWeek}
        onToday={goToday}
      />
      {params.view !== "week" ? (
        <EmptyState icon={COMING[params.view].icon} title="On its way">{COMING[params.view].text}</EmptyState>
      ) : (
        <>
          {data.status === "loading" && (
            <div role="status" aria-label="Loading your week">
              <Skeleton className="plan-skeleton" height="480px" />
            </div>
          )}
          {data.status === "failed" && (
            <div className="plan-failed" role="alert">
              <p>{data.error}</p>
              <Button variant="secondary" onClick={data.reload}>Try again</Button>
            </div>
          )}
          {data.status === "ready" && (
            <>
              <WeekGrid key={params.weekStart.getTime()} days={days} now={now} onToggle={setDone} direction={direction} />
              {nothingPlanned && <p className="plan-quiet">Nothing is planned for this week yet.</p>}
            </>
          )}
        </>
      )}
    </Page>
  );
}
