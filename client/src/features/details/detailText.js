// The words the details window shows, worked out from a task or entry. Pure, with relative imports
// only, so a server test can import it (server/tests/itemLinks.test.js).
import { KIND_LABELS, fromISODate, toISODate } from "../../utils/scheduleUtils.js";

const WEEKDAY = { weekday: "short" };
const SHORT_DAY = { weekday: "short", month: "short", day: "numeric" };
const DAY_MS = 86400000;

const isoOf = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");
const weekday = (iso) => fromISODate(iso).toLocaleDateString("en-US", WEEKDAY);
// "Thu, Oct 30" from a YYYY-MM-DD string.
export const shortDay = (iso) => fromISODate(iso).toLocaleDateString("en-US", SHORT_DAY);
const daysBetween = (fromIso, toIso) => Math.round((fromISODate(toIso) - fromISODate(fromIso)) / DAY_MS);

const minutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// "9:00 am" from "09:00".
export function clock(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
}

// "9:00 to 11:00 am" when both ends share am or pm, "11:00 am to 1:00 pm" when they don't.
export function timeSpan(startTime, endTime) {
  const from = clock(startTime);
  const to = clock(endTime);
  return from.slice(-2) === to.slice(-2) ? `${from.slice(0, -3)} to ${to}` : `${from} to ${to}`;
}

// ---- Tasks -----------------------------------------------------------------

// "Medium, about 3 hours" (the name follows effortLabel in shared/lib/effort.js). "" when there are no hours.
export function sizeText(hours) {
  const h = Number(hours) || 0;
  if (h <= 0) return "";
  const name = h <= 1.5 ? "Small" : h <= 4 ? "Medium" : "Large";
  const amount = Number(h.toFixed(1));
  return `${name}, about ${amount} ${amount === 1 ? "hour" : "hours"}`;
}

// The status chip under the title: how close the due day is. A task is due on a day (stored as midnight
// UTC), so it is read back as that day. A done task has no chip (it shows a "Done on" row instead).
export function taskChip(task, now) {
  if (task.isCompleted) return null;
  const dueIso = isoOf(task.dueDate);
  if (!dueIso) return null;
  const days = daysBetween(toISODate(now), dueIso);
  if (days < 0) {
    const was = days > -7 ? weekday(dueIso) : fromISODate(dueIso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { label: `Overdue, was due ${was}`, tone: "danger" };
  }
  if (days === 0) return { label: "Due today", tone: "watch" };
  if (days === 1) return { label: "Due tomorrow", tone: "watch" };
  return { label: `Due ${shortDay(dueIso)}`, tone: "neutral" };
}

export const taskDueText = (task) => (task.dueDate ? shortDay(isoOf(task.dueDate)) : "");

// "Wed, Oct 29" for the day a task was ticked off, in the student's own time.
export const doneOnText = (task) => (task.completedAt ? shortDay(toISODate(new Date(task.completedAt))) : "");

// ---- Timetable entries -----------------------------------------------------

export const kindName = (kind) => KIND_LABELS[kind] ?? "Entry";

// The line under the title: the kind, then what makes it this one. A class knows its weekdays when it comes
// from a timetable's own list ("Every Tue and Thu"); the week overview only carries the day it is on.
export function entrySubtitle(entry, iso, repeat) {
  const kind = kindName(entry.kind);
  if (entry.kind === "exam") return `${kind} · ${shortDay(iso)}`;
  if (entry.kind === "event" && entry.date) return `${kind} · One day`;
  return repeat ? `${kind} · ${repeat}` : kind;
}

// "Thu, 9:00 to 11:00 am" for a class or activity, "Sat, Nov 1, 1:00 to 4:00 pm" for a dated exam or event.
export function entryWhen(entry, iso) {
  const day = entry.kind === "exam" || entry.kind === "event" ? shortDay(iso) : weekday(iso);
  return `${day}, ${timeSpan(entry.startTime, entry.endTime)}`;
}

// The status chip for an entry on day `iso`, or null. `live` is true while it is running.
export function entryChip(entry, iso, now, live) {
  if (live) return { label: "On now", tone: "good" };
  const days = daysBetween(toISODate(now), iso);
  const dated = entry.kind === "exam" || entry.kind === "event";
  if (days < 0) return null;
  if (entry.kind === "event") return { label: days === 0 ? "Today" : shortDay(iso), tone: days === 0 ? "watch" : "accent" };
  if (days === 0) {
    if (now.getHours() * 60 + now.getMinutes() >= minutes(entry.endTime)) return { label: "Finished", tone: "neutral" };
    return { label: dated ? "Today" : `Today, ${clock(entry.startTime)}`, tone: "watch" };
  }
  if (days === 1) return { label: dated ? "Tomorrow" : `Tomorrow, ${clock(entry.startTime)}`, tone: "watch" };
  if (dated) return { label: shortDay(iso), tone: "neutral" };
  return { label: `Next: ${weekday(iso)}, ${clock(entry.startTime)}`, tone: "neutral" };
}

export function prepText(hours) {
  const h = Number(hours) || 0;
  if (h <= 0) return "";
  const amount = Number(h.toFixed(1));
  return `${amount} ${amount === 1 ? "hour" : "hours"} of study before it`;
}

// "meet.google.com/abc-defg-hij": the link without its scheme or a trailing slash.
export const linkLabel = (url) => url.replace(/^https?:\/\//i, "").replace(/\/$/, "");

// ---- A day ------------------------------------------------------------------

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const KIND_COUNTS = [["class", "class", "classes"], ["exam", "exam", "exams"], ["event", "event", "events"], ["activity", "activity", "activities"]];

// The line under the day window's title: how heavy the day is, then what is on it.
// "Busy day · 3 classes, 1 exam, 2 tasks due", "Day off · 1 task due", "Free day". `day` is from buildDay,
// whose `load` is "heavy" or "light".
export function daySummary(day) {
  const parts = KIND_COUNTS
    .map(([kind, one, many]) => [day.entries.filter((entry) => entry.kind === kind).length, one, many])
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => count(n, one, many));
  if (day.tasks.length > 0) parts.push(`${count(day.tasks.length, "task", "tasks")} due`);
  const lead = day.holiday ? "Day off" : parts.length === 0 ? "Free day" : day.load === "heavy" ? "Busy day" : "Light day";
  return [lead, parts.join(", ")].filter(Boolean).join(" · ");
}
