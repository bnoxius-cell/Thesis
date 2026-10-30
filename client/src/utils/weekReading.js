import { differenceInDays } from "./workload";
import { BAND_MESSAGE, bandLabel, topReasons } from "./weekReasons";

// The line that goes with every place a workload number or band shows (owner, 2026-10-28).
export const WORKLOAD_NOTE = "This is a workload estimate, not a measure of your stress.";

// 'light' | 'steady' | 'full' | 'over'. The internal band names stay as they are.
const BAND_KEY = {
  "Light Workload": "light",
  "Moderate Workload": "steady",
  "Heavy Workload": "full",
  "Critical Overload": "over",
};

const MAX_REASONS = 3;

// How the week reads, in one object the Today week card renders. It is the seam for the AI
// planner work (W2.5/W2.6): when that lands, only the inside of this function changes and the card
// stays as it is. Words come first; `score` is carried for Wellbeing and never shown on Today.
//
//   band      'light' | 'steady' | 'full' | 'over'
//   label     "Light week" | "Steady week" | "Full week" | "Very full week"
//   headline  one sentence for the week
//   reasons   up to 3 plain-words reasons
//   actions   up to 1 for now: { label, to }
//   note      WORKLOAD_NOTE, always present
//   score     the 0 to 100 estimate
export function toWeekReading({ insights, plannedTasks = [], now = new Date() }) {
  const band = BAND_KEY[insights.band] || "light";

  const overdue = plannedTasks.filter((task) => task.dueDate && differenceInDays(task.dueDate, now) < 0).length;
  // Things due today through the next 6 days (a rolling 7 days). Overdue ones have their own button.
  const dueSoon = plannedTasks.filter((task) => {
    if (!task.dueDate) return false;
    const days = differenceInDays(task.dueDate, now);
    return days >= 0 && days <= 6;
  }).length;

  const action = overdue > 0
    ? { label: "See overdue tasks", to: "/plan?view=tasks" }
    : { label: "See details", to: "/wellbeing" };

  return {
    band,
    label: bandLabel(insights.band),
    headline: BAND_MESSAGE[insights.band] || "",
    reasons: topReasons(insights.parts, dueSoon, MAX_REASONS, insights.band).slice(0, MAX_REASONS),
    actions: [action],
    note: WORKLOAD_NOTE,
    score: insights.workloadScore ?? 0,
  };
}
