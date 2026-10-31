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

// "Exam in 6 days" for the subject's nearest exam within two weeks, or "".
export function examChipText(entries, subject, now = new Date()) {
  const todayIso = toISODate(now);
  const today = fromISODate(todayIso);
  const days = entriesFor(entries, subject, "exam")
    .filter((entry) => entry.date && entry.date >= todayIso)
    .map((entry) => Math.round((fromISODate(entry.date) - today) / 86400000))
    .filter((n) => n <= EXAM_WINDOW_DAYS)
    .sort((a, b) => a - b)[0];
  if (days === undefined) return "";
  if (days === 0) return "Exam today";
  return days === 1 ? "Exam tomorrow" : `Exam in ${days} days`;
}
