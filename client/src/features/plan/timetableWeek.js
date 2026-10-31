import { addDays, entryOccursOn, resolveHoliday, toISODate } from "@/utils/scheduleUtils";

const minutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// Hours covered by a day's entries, with overlapping ones counted once (same rule as the server's
// week overview, so a single timetable's load dot reads like My week's).
function busyHours(entries) {
  const ranges = entries.map((e) => [minutes(e.startTime), minutes(e.endTime)]).sort((a, b) => a[0] - b[0]);
  let total = 0;
  let end = -1;
  for (const [from, to] of ranges) {
    total += Math.max(to - Math.max(from, end), 0);
    end = Math.max(end, to);
  }
  return Math.round((total / 60) * 10) / 10;
}

// One timetable's seven days for the Monday-to-Sunday week at `weekStart`, in the same shape as the
// server's week overview ({ days: [{ date, holiday, busyHours, entries }] }) so buildPlanDays can
// draw it. `publicByDate` maps "YYYY-MM-DD" to a public holiday name; the timetable's own day-off
// edits win over it. Entries that skip holidays drop out of a day off. `schedule` null gives an
// empty week (the timetable has not loaded yet).
export function timetableWeek(schedule, weekStart, publicByDate) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = toISODate(addDays(weekStart, i));
    const holiday = schedule ? resolveHoliday(date, publicByDate, schedule.holidayOverrides ?? [])?.name ?? null : null;
    const entries = (schedule?.entries ?? [])
      .filter((entry) => entryOccursOn(entry, date) && !(holiday && entry.skipOnHoliday))
      .map((entry) => ({
        title: entry.title,
        kind: entry.kind,
        startTime: entry.startTime,
        endTime: entry.endTime,
        location: entry.location || "",
        meetingUrl: entry.meetingUrl || "",
      }))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    return { date, holiday, busyHours: busyHours(entries), entries };
  });
  return { days };
}

// The years a Monday-to-Sunday week touches (two around New Year), for the holiday lookups.
export function weekYears(weekStart) {
  return [...new Set([weekStart.getFullYear(), addDays(weekStart, 6).getFullYear()])];
}
