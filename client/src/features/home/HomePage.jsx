import { Button, Skeleton } from "@/shared/ui";
import Page from "@/app/shell/Page";
import { useAuth } from "@/pages/authentication/AuthContext";
import useNow from "@/shared/hooks/useNow";
import useWeekData from "@/features/workload/useWeekData";
import useWorkload from "@/features/workload/useWorkload";
import useTaskDone from "@/features/tasks/useTaskDone";
import TodayHero from "./TodayHero";
import ThisWeekCard from "./ThisWeekCard";
import "./home.css";

// The greeting and the Today hero read the same clock (phaseFor in todayFocus.js).
const GREETING = { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", night: "Good evening" };

const DATE_FORMAT = { weekday: "long", month: "short", day: "numeric" };

function HomeSkeleton() {
  return (
    <div className="home-grid" role="status" aria-label="Loading your day">
      <Skeleton className="home-skeleton" height="360px" />
      <Skeleton className="home-skeleton" height="360px" />
    </div>
  );
}

// Home (Figma 16:3): the Today hero and This week. Next step, Plan for you and the quiet line join in
// the grid in the next batch.
export default function HomePage() {
  const { userData } = useAuth();
  const now = useNow();
  const data = useWeekData();
  const work = useWorkload({ tasks: data.tasks, overview: data.overview, userData, now });
  const setDone = useTaskDone(data.setTasks);

  const firstName = userData?.name?.trim().split(/\s+/)[0];
  const title = `${GREETING[work.focus.phase]}${firstName ? `, ${firstName}` : ""}`;
  const dueToday = work.enrichedTasks.filter((task) => task.daysLeft <= 0).sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <Page title={title} subtitle={now.toLocaleDateString("en-US", DATE_FORMAT)}>
      {data.status === "loading" && <HomeSkeleton />}
      {data.status === "failed" && (
        <div className="home-failed" role="alert">
          <p>{data.error}</p>
          <Button variant="secondary" onClick={data.reload}>Try again</Button>
        </div>
      )}
      {data.status === "ready" && (
        <div className="home-grid">
          <TodayHero
            focus={work.focus}
            today={work.today}
            tasks={dueToday}
            subjectsById={data.subjectsById}
            now={now}
            isNewUser={work.insights.isNewUser}
            onToggle={setDone}
          />
          <ThisWeekCard work={work} tasks={data.tasks} now={now} />
        </div>
      )}
    </Page>
  );
}
