import { addDays, entryOccursOn, startOfWeek, toISODate } from "./scheduleUtils";
import { subjectForLabel } from "./subjectColors";

// The classes of one subject in this Monday-to-Sunday week, in order. Schedule entries never carry a
// subject id, so a class belongs to the subject when its title matches the subject's name or code by key.
// Returns [{ iso, entry }].
export function classesThisWeek(entries = [], subject, now = new Date()) {
  const mine = entries.filter((entry) => (entry.kind || "class") === "class" && subjectForLabel(entry.title, [subject]));
  const monday = startOfWeek(now);
  const found = [];
  for (let i = 0; i < 7; i += 1) {
    const iso = toISODate(addDays(monday, i));
    mine
      .filter((entry) => entryOccursOn(entry, iso))
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .forEach((entry) => found.push({ iso, entry }));
  }
  return found;
}
