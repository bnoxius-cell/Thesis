import { toISODate } from "@/utils/scheduleUtils";
import { PSS_VALID_DAYS, WHO_VALID_DAYS } from "@/utils/workload";

// When a check-in is due and how "Later" is counted. Pure: the snooze record comes in as an argument
// (surveySnooze.js keeps it in the browser) so this file can be read, reused and tested on its own.

// PSS-10 comes first when both are due.
export const SURVEY_KINDS = ["pss", "who"];
// After this many Laters in one due cycle the button goes and the prompt stays until it is taken.
export const LATER_LIMIT = 3;

// New accounts get a quiet first day: no prompt until this long after registration. Accounts from before
// createdAt existed get no grace period.
const GRACE_MS = 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const SURVEYS = {
  pss: { validDays: PSS_VALID_DAYS, lastField: "lastPSSSubmission" },
  who: { validDays: WHO_VALID_DAYS, lastField: "lastWHOSubmission" },
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const isInGrace = (createdAt, now) => Boolean(createdAt) && now - new Date(createdAt) < GRACE_MS;

// The day a due cycle began (YYYY-MM-DD): the last check-in plus its valid days, or the end of the grace
// day for one never taken. Taking the check-in moves it, which starts a fresh Later count.
function dueSince(last, validDays, createdAt) {
  if (last) {
    const d = startOfDay(last);
    d.setDate(d.getDate() + validDays);
    return toISODate(d);
  }
  return createdAt ? toISODate(new Date(new Date(createdAt).getTime() + GRACE_MS)) : "";
}

// `saved` is the snooze record for this kind, { since, count, until }, or null.
// Answers { kind, since, due, canLater }.
export function surveyDue(kind, user, saved, now) {
  const { validDays, lastField } = SURVEYS[kind];
  const last = user[lastField];
  const since = dueSince(last, validDays, user.createdAt);
  const record = saved?.since === since ? saved : null;

  const overdue = last
    ? (startOfDay(now) - startOfDay(last)) / DAY_MS >= validDays
    : !isInGrace(user.createdAt, now);
  const snoozed = Boolean(record) && now.getTime() < record.until;
  return { kind, since, due: overdue && !snoozed, canLater: (record?.count ?? 0) < LATER_LIMIT };
}

// The first check-in that is due (PSS-10 before WHO-5), or null. `readSaved(kind)` gives the record.
export function nextDueSurvey(user, readSaved, now) {
  if (!user) return null;
  for (const kind of SURVEY_KINDS) {
    const status = surveyDue(kind, user, readSaved(kind), now);
    if (status.due) return status;
  }
  return null;
}

// The record after one Later: hidden until tomorrow, and counted.
export function nextSnooze(saved, since, now) {
  const until = startOfDay(now);
  until.setDate(until.getDate() + 1);
  return { since, count: (saved?.since === since ? saved.count : 0) + 1, until: until.getTime() };
}
