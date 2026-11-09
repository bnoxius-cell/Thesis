// Links and matching for the details window. Pure, with relative imports only (no "@/" alias), so a
// server test can import it (server/tests/itemLinks.test.js).
import { subjectForLabel, courseKey } from "../../utils/subjectColors.js";
import { WEEKDAYS, fromISODate, startOfWeek, toISODate } from "../../utils/scheduleUtils.js";

// The Tasks view of Plan, landing on one task (mirrors taskLink in server/utils/appLinks.js).
export const taskHref = (taskId) => `/plan?view=tasks&task=${encodeURIComponent(taskId)}`;

export const subjectHref = (subjectId) => `/study/subjects/${subjectId}`;

// Plan on the week that holds `iso`, with that day picked. The current week is the default, so it
// leaves no ?week= behind (same rule as weekValue in features/plan/planParams.js).
export function planDayHref(iso, today = new Date()) {
  const monday = toISODate(startOfWeek(fromISODate(iso)));
  const thisMonday = toISODate(startOfWeek(today));
  return `/plan?${monday === thisMonday ? "" : `week=${monday}&`}day=${iso}`;
}

// The subject a task belongs to: by its id, else by the free-text course label.
export function taskSubject(task, subjects) {
  if (task.subject) {
    const byId = subjects.find((s) => s._id === task.subject);
    if (byId) return byId;
  }
  return subjectForLabel(task.course, subjects);
}

const words = (text) => (typeof text === "string" ? text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [] : []);

// How many words of `phrase` sit together, whole, inside `title` (0 when they don't). Whole words only:
// "IT 301" is in "Quiz for IT 301" but "Math" is not in "Mathematics".
function phraseWordsIn(title, phrase) {
  const need = words(phrase);
  if (need.length === 0 || courseKey(phrase).length < 2) return 0;
  const have = words(title);
  for (let from = 0; from + need.length <= have.length; from += 1) {
    if (need.every((word, i) => have[from + i] === word)) return need.length;
  }
  return 0;
}

// An exam is titled like "Midterm: Information Assurance", so it matches a subject when the title holds
// the subject's name or code as whole words. The subject with the longest match wins, so "Discrete Math"
// beats "Math". subjectForLabel stays as it is (a server test keeps it the same as courseKey).
function subjectInTitle(title, subjects) {
  let best = null;
  let bestScore = 0;
  for (const subject of subjects) {
    const score = Math.max(phraseWordsIn(title, subject.name), phraseWordsIn(title, subject.code));
    if (score > bestScore) {
      best = subject;
      bestScore = score;
    }
  }
  return best;
}

// The subject a timetable entry belongs to. Entries carry no subject id (a shared timetable would point at
// someone else's), so a class matches by its title and an exam also by the words in its title. Events and
// activities have none.
export function entrySubject(entry, subjects) {
  if (entry.kind === "class") return subjectForLabel(entry.title, subjects);
  if (entry.kind === "exam") return subjectForLabel(entry.title, subjects) ?? subjectInTitle(entry.title, subjects);
  return null;
}

const minutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// True while the entry is running on day `iso`: from its start minute up to, but not including, its end.
export function entryIsLive(entry, iso, now) {
  if (iso !== toISODate(now)) return false;
  const at = now.getHours() * 60 + now.getMinutes();
  return minutes(entry.startTime) <= at && at < minutes(entry.endTime);
}

// "Every Tue and Thu", "Every Mon, Wed and Fri" from Date#getDay numbers, Monday first. "" for none.
export function repeatText(days) {
  const names = WEEKDAYS.filter((d) => days?.includes(d.value)).map((d) => d.short);
  if (names.length === 0) return "";
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `Every ${list}`;
}
