import { fromISODate } from "@/utils/scheduleUtils";

// "Fri, Oct 30" from a YYYY-MM-DD string.
export const shortDate = (iso) =>
  fromISODate(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

const DAY_MS = 24 * 60 * 60 * 1000;

// "Today", "Yesterday" or "12 days ago" for a past moment, counted in calendar days.
export function daysAgoText(value, now = new Date()) {
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.max(0, Math.round((startOfDay(now) - startOfDay(new Date(value))) / DAY_MS));
  if (days === 0) return "Today";
  return days === 1 ? "Yesterday" : `${days} days ago`;
}
