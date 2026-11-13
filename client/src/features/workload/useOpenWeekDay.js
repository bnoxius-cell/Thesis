import { buildDay, findOverviewDay } from "@/features/plan/planDays";
import { toISODate } from "@/utils/scheduleUtils";

// The handler for the week bars on Home and Wellbeing: opens the day window (useItemDetail's openDay) for
// the day a bar stands for. `overview` is the page's week overview (useWeekData); `profile` is work.profile.
//   const openDay = useOpenWeekDay({ detail, overview: data.overview, tasks: data.tasks, subjects, profile: work.profile, now });
//   <WeekBars onOpenDay={openDay} />
export default function useOpenWeekDay({ detail, overview, tasks, subjects, profile, now }) {
  return (iso) => {
    const overviewDay = findOverviewDay([overview], iso);
    detail.openDay(buildDay({ iso, overviewDay, tasks, subjects, profile, todayIso: toISODate(now) }));
  };
}
