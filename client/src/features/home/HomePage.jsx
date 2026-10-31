import { Button, Skeleton } from "@/shared/ui";
import Page from "@/app/shell/Page";
import { useAuth } from "@/pages/authentication/AuthContext";
import useNow from "@/shared/hooks/useNow";
import useWeekData from "@/features/workload/useWeekData";
import useWorkload from "@/features/workload/useWorkload";
import useTaskDone from "@/features/tasks/useTaskDone";
import useMoveSuggestions from "@/features/tasks/useMoveSuggestions";
import { finishedRecently } from "@/features/tasks/finishedRecently";
import TodayHero from "./TodayHero";
import ThisWeekCard from "./ThisWeekCard";
import NextStepCard from "./NextStepCard";
import PlanForYou from "./PlanForYou";
import QuietLine from "./QuietLine";
import useCheckInPrompt from "./useCheckInPrompt";
import "./home.css";

// The greeting and the Today hero read the same clock (phaseFor in todayFocus.js).
const GREETING = { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", night: "Good evening" };

const DATE_FORMAT = { weekday: "long", month: "short", day: "numeric" };

function HomeSkeleton() {
  return (
    <div className="home-grid" role="status" aria-label="Loading your day">
      <Skeleton className="home-skeleton" height="360px" />
      <Skeleton className="home-skeleton" height="360px" />
      <Skeleton className="home-skeleton home-skeleton--next" height="240px" />
    </div>
  );
}

// Home (Figma 16:3): the Today hero, This week and Next step, then Plan for you and a quiet line.
// On phones the order changes to Today, Plan for you, This week, Next step (home.css).
export default function HomePage() {
  const { userData } = useAuth();
  const now = useNow();
  const data = useWeekData();
  const work = useWorkload({ tasks: data.tasks, overview: data.overview, userData, now });
  const setDone = useTaskDone(data.setTasks);
  const { prompt, later } = useCheckInPrompt(userData, now);
  const moves = useMoveSuggestions({
    userId: userData?._id,
    tasks: data.tasks,
    setTasks: data.setTasks,
    fixedTasks: work.examTasks,
    profile: work.profile,
    overview: data.overview,
    strained: work.strained,
    now,
  });

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
          <NextStepCard prompt={prompt} onLater={later} moves={moves} work={work} now={now} />
          <PlanForYou tasks={work.enrichedTasks} exam={work.nextExam} subjectsById={data.subjectsById} now={now} />
          <QuietLine finished={finishedRecently(data.tasks, now)} />
        </div>
      )}
    </Page>
  );
}
