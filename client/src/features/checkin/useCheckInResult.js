import { useMemo } from "react";
import { useAuth } from "@/pages/authentication/AuthContext";
import useNow from "@/shared/hooks/useNow";
import { shortDate } from "@/shared/lib/dates";
import useWeekData from "@/features/workload/useWeekData";
import useWorkload from "@/features/workload/useWorkload";
import { finishedRecently } from "@/features/tasks/finishedRecently";
import { sleepSummary } from "@/features/wellbeing/sleepSummary";
import { buildCheckInResult } from "@/utils/checkinResult";
import { isStrained, suggestMoves } from "@/utils/suggestions";
import { surveyStatus } from "@/utils/workload";
import { QUESTIONNAIRES } from "./questionnaires";

// The score of a check-in as the week reads it: null when it was never taken or has gone stale.
function freshScore(kind, user, now) {
  const { scoreField, lastField, validDays } = QUESTIONNAIRES[kind];
  return surveyStatus(user?.[scoreField] ?? null, user?.[lastField] || null, validDays, now).score;
}

function planLine(plan, idea) {
  if (plan.suggestion) return `Moving "${idea.title}" to ${shortDate(idea.toDate)} would lighten your week.`;
  if (plan.warnSooner) return "We'll warn you sooner when a day gets full.";
  return "Your week fits as it is. We'll keep an eye on it.";
}

// What "What this changes" says after a check-in, worked out from the student's week (the wording
// rules live in utils/checkinResult.js). `score` is the one the server just saved, so the page doesn't
// wait for the account to refresh.
//   status   "loading" | "ready" | "failed" (the week couldn't be read, so there is nothing to say yet)
//   changes  { plan, sleep, tip, encouragement } once ready
export default function useCheckInResult(kind, score) {
  const { userData } = useAuth();
  const now = useNow();
  const data = useWeekData();
  const work = useWorkload({ tasks: data.tasks, overview: data.overview, userData, now });

  const changes = useMemo(() => {
    if (data.status !== "ready") return null;
    const pssScore = kind === "pss" ? score : freshScore("pss", userData, now);
    const whoScore = kind === "who" ? score : freshScore("who", userData, now);
    const strained = isStrained({ band: work.insights.band, pssScore, whoScore });
    const [idea = null] = strained
      ? suggestMoves({ tasks: data.tasks, fixedTasks: work.examTasks, profile: work.profile, overview: data.overview, strained, now })
      : [];
    const smallest = data.tasks.filter((t) => !t.isCompleted).sort((a, b) => (a.hours || 0) - (b.hours || 0))[0];
    // No sleep plan here: the tip slot always gets a tip, and the sleep row says what tonight looks like.
    const result = buildCheckInResult({
      kind, score, pssScore, whoScore, strained, suggestion: idea,
      smallestTask: smallest?.title || "", finishedCount: finishedRecently(data.tasks, now),
    });
    const sleep = sleepSummary({ week: work.week, profile: work.profile, usualWakeTime: userData?.usualWakeTime });
    return {
      plan: planLine(result.plan, idea),
      sleep: sleep.note || sleep.headline,
      tip: result.today.text,
      encouragement: result.encouragement.join(" "),
    };
  }, [data.status, data.tasks, data.overview, work, userData, kind, score, now]);

  return { status: data.status, changes };
}
