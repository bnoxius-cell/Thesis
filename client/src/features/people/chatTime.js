// "9:12 am" for a message time.
export const clockTime = (iso) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();

const sameDay = (a, b) => a.toDateString() === b.toDateString();

// The chip between days in a chat: "Today", "Yesterday", or "Mon, Oct 24".
export function dayLabel(iso, now = new Date()) {
  const date = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, now)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
