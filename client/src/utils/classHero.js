import { entryOccursOn, fromISODate, toISODate } from "./scheduleUtils.js";

// What the Subject page's class hero says (plan 34 C3, Figma OV-F1 to OV-F8). Pure, with relative imports only
// (no "@/" alias), so a server test can run it (server/tests/classHero.test.js).
export const SOON_MINUTES = 15; // Join shows this long before a class (owner answer Q9)
const EXAM_DAYS = 14;
const LOOKAHEAD_DAYS = 56; // how far nextDateOf looks for a class time's next day
const MINUTES_PER_DAY = 1440;
const DAY_MS = 86400000;

const minutesOf = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const daysBetween = (iso, now) => Math.round((fromISODate(iso) - fromISODate(toISODate(now))) / DAY_MS);

// Which of five things the hero shows, from the subject's class times and its next two weeks of classes and exams
// (`upcoming`: [{ iso, entry }], from GET /api/subjects/:id/schedule):
//   { state: "none" }   no class times at all: the hero asks when the subject meets
//   { state: "idle" }   class times, but no class in the next two weeks
//   { state: "now",  iso, entry, minutesLeft }
//   { state: "soon", iso, entry, minutesUntil, days }   starts within SOON_MINUTES: Join shows
//   { state: "next", iso, entry, minutesUntil, days }   later; `days` is calendar days from today
// The class that matters is the first one that hasn't finished yet, so the hero moves on by itself as `now` does.
export function heroState(classTimes, upcoming, now = new Date()) {
  if (classTimes.length === 0) return { state: "none" };
  const today = toISODate(now);
  const at = now.getHours() * 60 + now.getMinutes();
  const next = upcoming
    .filter(({ iso, entry }) => entry.kind === "class" && (iso > today || (iso === today && minutesOf(entry.endTime) > at)))
    .sort((a, b) => a.iso.localeCompare(b.iso) || a.entry.startTime.localeCompare(b.entry.startTime))[0];
  if (!next) return { state: "idle" };

  const { iso, entry } = next;
  const days = daysBetween(iso, now);
  const minutesUntil = days * MINUTES_PER_DAY + minutesOf(entry.startTime) - at;
  if (minutesUntil <= 0) return { state: "now", iso, entry, minutesLeft: minutesOf(entry.endTime) - at };
  return { state: minutesUntil <= SOON_MINUTES ? "soon" : "next", iso, entry, minutesUntil, days };
}

// "in 40 min", "in 18 h", "in 3 days": how far off a class is, from heroState's minutesUntil and days.
export function inText({ minutesUntil, days }) {
  if (minutesUntil < 60) return `in ${minutesUntil} min`;
  if (minutesUntil < MINUTES_PER_DAY) return `in ${Math.round(minutesUntil / 60)} h`;
  return `in ${days} ${days === 1 ? "day" : "days"}`;
}

// "Today", "Tomorrow", a weekday name inside the week, "Mon, Nov 24" beyond it.
export function dayWord(iso, now = new Date()) {
  const days = daysBetween(iso, now);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return fromISODate(iso).toLocaleDateString("en-US", days < 7 ? { weekday: "long" } : { weekday: "short", month: "short", day: "numeric" });
}

// "Midterm" from "Midterm: Information Assurance"; "Exam" when the title only says the subject (or nothing more).
function examLabel(title, subject) {
  const head = title.split(":")[0].trim();
  const isSubject = [subject.name, subject.code].some((text) => text && head.toLowerCase() === text.toLowerCase());
  return !head || isSubject ? "Exam" : head;
}

// The nearest exam of the subject within two weeks that hasn't finished: { entry, iso, days, label }, or null. The
// entry carries kind "exam", so the details window can open it.
export function examLine(upcoming, subject, now = new Date()) {
  const today = toISODate(now);
  const at = now.getHours() * 60 + now.getMinutes();
  const next = upcoming
    .filter(({ iso, entry }) => entry.kind === "exam" && daysBetween(iso, now) <= EXAM_DAYS && (iso > today || (iso === today && minutesOf(entry.endTime || entry.startTime) > at)))
    .sort((a, b) => a.iso.localeCompare(b.iso) || (a.entry.startTime || "").localeCompare(b.entry.startTime || ""))[0];
  if (!next) return null;
  return { entry: next.entry, iso: next.iso, days: daysBetween(next.iso, now), label: examLabel(next.entry.title, subject) };
}

// Where a class time lives, when it isn't on the main timetable: "On Org officers" for one the student can change,
// "From Org officers" for a shared one they can only look at. "" for the main timetable.
export const whereText = (time) => (time.isMain ? "" : `${time.canEdit ? "On" : "From"} ${time.scheduleTitle}`);

// A class time as the details window and the edit dialogs take it (an entry the week overview would give).
export const classEntry = (time, subject) => ({ ...time, title: subject.name, kind: "class", subject: subject._id });

// The first day from today on that a class time happens, as YYYY-MM-DD; today when it has none soon (a window
// needs a day to show).
export function nextDateOf(time, now = new Date()) {
  for (let i = 0; i < LOOKAHEAD_DAYS; i += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const iso = toISODate(day);
    if (entryOccursOn(time, iso)) return iso;
  }
  return toISODate(now);
}
