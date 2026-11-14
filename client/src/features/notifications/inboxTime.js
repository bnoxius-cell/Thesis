import { dayLabel } from "@/features/people/chatTime";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const sameDay = (a, b) => a.toDateString() === b.toDateString();

// The short time on a row: "Just now", "5m", "2h", "Yesterday", then "Nov 9".
export function inboxTime(iso, now = new Date()) {
  const date = new Date(iso);
  const age = now - date;
  if (age < MINUTE) return "Just now";
  if (age < HOUR) return `${Math.floor(age / MINUTE)}m`;
  if (sameDay(date, now)) return `${Math.floor(age / HOUR)}h`;
  if (dayLabel(iso, now) === "Yesterday") return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Today's notifications first, then everything earlier, by the local day of `activityAt`. The list keeps its order.
export function splitByDay(list, now = new Date()) {
  const today = list.filter((n) => sameDay(new Date(n.activityAt), now));
  const earlier = list.filter((n) => !sameDay(new Date(n.activityAt), now));
  return [
    { key: "today", label: "Today", items: today },
    { key: "earlier", label: "Earlier", items: earlier },
  ].filter((section) => section.items.length > 0);
}
