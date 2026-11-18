import { addDays, entryOccursOn, fromISODate, toISODate } from "@/utils/scheduleUtils";
import { subjectForLabel } from "@/utils/subjectColors";
import { lower } from "@/features/plan/entryTime";

const LOOKAHEAD_DAYS = 7;
const EXAM_WINDOW_DAYS = 14;
const WEEKDAY = { weekday: "short" };

const entriesFor = (entries, subject, kind) =>
  entries.filter((entry) => (entry.kind || "class") === kind && subjectForLabel(entry.title, [subject]));

const clock = (date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

// The next class of one subject from `now`, as "Mon 8:00 am · Room 204" ("Today ..." when it is
// later today), or "" when no class of that subject falls in the coming week. Schedule entries
// never carry a subject id, so a class belongs to the subject when its title matches the
// subject's name or code.
export function nextClassText(entries, subject, now = new Date()) {
  const classes = entriesFor(entries, subject, "class");
  const todayIso = toISODate(now);
  for (let i = 0; i <= LOOKAHEAD_DAYS; i += 1) {
    const day = addDays(now, i);
    const iso = toISODate(day);
    const next = classes
      .filter((entry) => entryOccursOn(entry, iso) && (i > 0 || entry.startTime > clock(now)))
      .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
    if (next) {
      const when = iso === todayIso ? "Today" : day.toLocaleDateString("en-US", WEEKDAY);
      return [`${when} ${lower(next.startTime)}`, next.location].filter(Boolean).join(" · ");
    }
  }
  return "";
}

// Whole calendar days from `now` to a YYYY-MM-DD date.
export const daysUntilIso = (iso, now = new Date()) =>
  Math.round((fromISODate(iso) - fromISODate(toISODate(now))) / 86400000);

// "Exam in 6 days", "Exam tomorrow" or "Exam today".
export const examWords = (days) => (days === 0 ? "Exam today" : days === 1 ? "Exam tomorrow" : `Exam in ${days} days`);

// "Exam in 6 days" for the subject's nearest exam within two weeks, or "".
export function examChipText(entries, subject, now = new Date()) {
  const todayIso = toISODate(now);
  const days = entriesFor(entries, subject, "exam")
    .filter((entry) => entry.date && entry.date >= todayIso)
    .map((entry) => daysUntilIso(entry.date, now))
    .filter((n) => n <= EXAM_WINDOW_DAYS)
    .sort((a, b) => a - b)[0];
  return days === undefined ? "" : examWords(days);
}
