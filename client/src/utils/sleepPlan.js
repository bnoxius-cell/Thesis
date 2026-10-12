// A bedtime worked out from tomorrow's first class or exam. It only speaks up when that bedtime is
// earlier than the student's usual one (or they haven't set one), so it's a nudge with a reason,
// not a rule.
//
//   wake    = first start - half the daily travel (one way) - 60 minutes to get ready
//   bedtime = wake - the sleep target

const GET_READY_MINUTES = 60;

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
};

const clock = (minutes) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm} ${h24 < 12 ? "AM" : "PM"}`;
};

// Bedtimes before 6 AM belong to the night before's evening clock, so 12:30 AM counts as later
// than 11:30 PM when comparing.
const eveningScale = (minutes) => {
  let m = ((minutes % 1440) + 1440) % 1440;
  if (m < 360) m += 1440;
  return m;
};

// The earliest class or exam in a day's entries, or null.
export function firstStartOf(entries = []) {
  const timed = entries
    .filter((entry) => (entry.kind === "class" || entry.kind === "exam") && entry.startTime)
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  return timed[0] ? { startTime: timed[0].startTime, kind: timed[0].kind } : null;
}

// first          { startTime: "07:30", kind: "class" | "exam" } or null
// travelMinutes  the student's daily travel total, as saved on their profile (0 if none)
// sleepHours     their sleep target
// usualSleepStart  "23:00", or empty when they haven't said
export function sleepPlan({ first, travelMinutes = 0, sleepHours = 8, usualSleepStart = "" }) {
  if (!first?.startTime) return null;
  const oneWay = Math.max(0, Number(travelMinutes) || 0) / 2;
  const sleep = Math.min(12, Math.max(4, Number(sleepHours) || 8));
  const wakeMinutes = toMinutes(first.startTime) - oneWay - GET_READY_MINUTES;
  const bedMinutes = wakeMinutes - sleep * 60;

  if (usualSleepStart && eveningScale(bedMinutes) >= eveningScale(toMinutes(usualSleepStart))) return null;

  const what = first.kind === "exam" ? "exam" : "class";
  const travelClause = oneWay >= 1 ? ` and it takes you about ${Math.round(oneWay)} minutes to get there` : "";
  return {
    bedtime: clock(bedMinutes),
    wakeUp: clock(wakeMinutes),
    firstStart: clock(toMinutes(first.startTime)),
    text: `Your first ${what} tomorrow is at ${clock(toMinutes(first.startTime))}${travelClause}. To get ${sleep} hours of sleep, be in bed by ${clock(bedMinutes)}.`,
  };
}

// The suggestion for tomorrow from the shared workload data (`week` and `profile`), or null.
export function tomorrowSleepPlan({ week, profile }) {
  const tomorrow = week?.[1];
  if (!tomorrow) return null;
  return sleepPlan({
    first: firstStartOf(tomorrow.entries),
    travelMinutes: profile.travelMinutesPerDay,
    sleepHours: profile.sleepHours,
    usualSleepStart: profile.hasRegularSleepSchedule ? profile.usualSleepStart : "",
  });
}
