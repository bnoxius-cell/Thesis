// Finds clashes between schedule entries. Pure functions with no imports, so the server's
// tests can exercise them too. Entries look like the ones the API sends: recurring ones
// have `days` (Date#getDay numbers) and optional startDate/endDate, one-off ones have `date`.

const minutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const weekdayOf = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
};

const timesOverlap = (a, b) => minutes(a.startTime) < minutes(b.endTime) && minutes(b.startTime) < minutes(a.endTime);

const inRange = (entry, iso) => (!entry.startDate || iso >= entry.startDate) && (!entry.endDate || iso <= entry.endDate);

// Can the two entries ever fall on the same day at overlapping times?
export const entriesOverlap = (a, b) => {
  if (!timesOverlap(a, b)) return false;
  if (a.date && b.date) return a.date === b.date;
  if (a.date) return b.days.includes(weekdayOf(a.date)) && inRange(b, a.date);
  if (b.date) return a.days.includes(weekdayOf(b.date)) && inRange(a, b.date);
  if (!a.days.some((d) => b.days.includes(d))) return false;
  const aStart = a.startDate || "0000-00-00";
  const aEnd = a.endDate || "9999-99-99";
  const bStart = b.startDate || "0000-00-00";
  const bEnd = b.endDate || "9999-99-99";
  return aStart <= bEnd && bStart <= aEnd;
};

const sameDays = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

// The same thing entered twice (same title, times and days), which is normal when two
// classmates share a class. Not a clash worth warning about.
export const isSameEntry = (a, b) =>
  a.title.trim().toLowerCase() === b.title.trim().toLowerCase()
  && a.startTime === b.startTime
  && a.endTime === b.endTime
  && (a.date || "") === (b.date || "")
  && sameDays(a.days || [], b.days || []);

// existing: [{ scheduleId, scheduleTitle, entry }]
// Returns { duplicate, conflicts } for one incoming entry.
export const analyzeEntry = (entry, existing) => {
  const duplicate = existing.find((e) => isSameEntry(entry, e.entry)) || null;
  const conflicts = duplicate ? [] : existing.filter((e) => entriesOverlap(entry, e.entry));
  return { duplicate, conflicts };
};

// Clashes among a single schedule's own entries, for flagging them in the week view.
// Returns a Map of entry _id -> titles it overlaps with on the given day.
export const overlapsOnDay = (dayEntries) => {
  const result = new Map();
  dayEntries.forEach((a, i) => {
    dayEntries.forEach((b, j) => {
      if (i === j || !timesOverlap(a, b)) return;
      result.set(a._id, [...(result.get(a._id) || []), b.title]);
    });
  });
  return result;
};
