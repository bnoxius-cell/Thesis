import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Button, Skeleton } from "@/shared/ui";
import Page from "@/app/shell/Page";
import { useAuth } from "@/pages/authentication/AuthContext";
import useNow from "@/shared/hooks/useNow";
import useHashScroll, { scrollToId } from "@/shared/hooks/useHashScroll";
import { nextDueSurvey } from "@/features/checkin/surveyDue";
import useWeekData from "@/features/workload/useWeekData";
import useWorkload from "@/features/workload/useWorkload";
import useMoveSuggestions from "@/features/tasks/useMoveSuggestions";
import CheckInCards from "./CheckInCards";
import FeelingSection from "./FeelingSection";
import HowThisWorks from "./HowThisWorks";
import LoadHero from "./LoadHero";
import RhythmCard from "./RhythmCard";
import SleepCard from "./SleepCard";
import { sleepSummary } from "./sleepSummary";
import "./wellbeing.css";

function WellbeingSkeleton() {
  return (
    <div className="wellbeing-stack" role="status" aria-label="Loading Wellbeing">
      <Skeleton className="wellbeing-skeleton" height="280px" />
      <Skeleton className="wellbeing-skeleton" height="140px" />
      <Skeleton className="wellbeing-skeleton" height="120px" />
    </div>
  );
}

// Wellbeing (Figma 51:2 desktop, 52:117 phone, 53:170 Why open, 53:459 new account): this week's load,
// how the student has been (the check-in cards), tonight's sleep, their rhythm and how it
// all works. #load, #feeling and #sleep are the targets of the sidebar links.
export default function WellbeingPage() {
  const { userData } = useAuth();
  const now = useNow();
  const data = useWeekData();
  const work = useWorkload({ tasks: data.tasks, overview: data.overview, userData, now });
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
  const { pathname, search, hash } = useLocation();
  const ready = data.status === "ready";
  useHashScroll(ready);

  // The header button goes to whichever check-in is due (a Later on Home doesn't hide it here); with
  // none due it scrolls down to the cards instead.
  const due = useMemo(() => nextDueSurvey(userData, () => null, now), [userData, now]);
  const checkIn = due ? (
    <Button variant="secondary" to={`/wellbeing/check-in/${due.kind}`} state={{ from: pathname + search + hash }}>
      Check in
    </Button>
  ) : (
    <Button variant="secondary" onClick={() => scrollToId("feeling")}>Check in</Button>
  );

  return (
    <Page title="Wellbeing" action={checkIn}>
      {data.status === "loading" && <WellbeingSkeleton />}
      {data.status === "failed" && (
        <div className="wellbeing-failed" role="alert">
          <p>{data.error}</p>
          <Button variant="secondary" onClick={data.reload}>Try again</Button>
        </div>
      )}
      {ready && (
        <div className="wellbeing-stack">
          <LoadHero work={work} moves={moves} />
          <FeelingSection>
            <CheckInCards user={userData} now={now} />
          </FeelingSection>
          <SleepCard
            summary={sleepSummary({ week: work.week, profile: work.profile, usualWakeTime: userData?.usualWakeTime })}
          />
          <RhythmCard profile={work.profile} user={userData} />
          <HowThisWorks />
        </div>
      )}
    </Page>
  );
}
