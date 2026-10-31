import { addDays, startOfWeek } from "@/utils/scheduleUtils";

const WEEK_MS = 7 * 86400000;
const DAY = { month: "short", day: "numeric" };

// "This week", "Next week", "Last week", otherwise how far off it is ("In 3 weeks", "2 weeks ago").
export function weekTitle(weekStart, now) {
  const offset = Math.round((weekStart - startOfWeek(now)) / WEEK_MS);
  if (offset === 0) return "This week";
  if (offset === 1) return "Next week";
  if (offset === -1) return "Last week";
  return offset > 0 ? `In ${offset} weeks` : `${-offset} weeks ago`;
}

// "Oct 27 – Nov 2", with the year when the week isn't in the current year.
export function weekRange(weekStart, now) {
  const end = addDays(weekStart, 6);
  const range = `${weekStart.toLocaleDateString("en-US", DAY)} – ${end.toLocaleDateString("en-US", DAY)}`;
  const otherYear = weekStart.getFullYear() !== now.getFullYear() || end.getFullYear() !== now.getFullYear();
  return otherYear ? `${range}, ${end.getFullYear()}` : range;
}
