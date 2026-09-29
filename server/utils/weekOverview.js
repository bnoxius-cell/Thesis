// Turns a user's schedules into a per-day picture of how much of each day is already
// spoken for. The dashboard's workload score uses it to work out how many hours are
// really left for studying. Pure functions, so they're easy to test.

const DAY_MS = 86400000;

const toDate = (iso) => new Date(`${iso}T00:00:00Z`);
export const addDaysIso = (iso, n) => new Date(toDate(iso).getTime() + n * DAY_MS).toISOString().slice(0, 10);
const weekdayOf = (iso) => toDate(iso).getUTCDay();

// Same rules as the client's entryOccursOn.
export const entryOccursOn = (entry, iso) => {
    if (entry.date) return entry.date === iso;
    if (!entry.days.includes(weekdayOf(iso))) return false;
    if (entry.startDate && iso < entry.startDate) return false;
    if (entry.endDate && iso > entry.endDate) return false;
    return true;
};

// An override always wins: 'workday' hides a public holiday, 'holiday' adds or renames one.
export const resolveHoliday = (iso, publicByDate, overrides = []) => {
    const override = overrides.find((o) => o.date === iso);
    const publicName = publicByDate[iso];
    if (override?.state === 'workday') return null;
    if (override?.state === 'holiday') return override.name || publicName || 'Day off';
    return publicName || null;
};

const minutes = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};

// Total minutes covered by a set of [start, end] ranges, counting overlaps once.
const unionMinutes = (ranges) => {
    const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
    let total = 0;
    let [curStart, curEnd] = [null, null];
    for (const [start, end] of sorted) {
        if (curEnd === null || start > curEnd) {
            if (curEnd !== null) total += curEnd - curStart;
            [curStart, curEnd] = [start, end];
        } else if (end > curEnd) {
            curEnd = end;
        }
    }
    if (curEnd !== null) total += curEnd - curStart;
    return total;
};

const round1 = (n) => Math.round(n * 10) / 10;

// schedules: plain objects with entries, holidayOverrides and holidays (a date -> name map
// already resolved for that schedule's country).
export const buildWeekOverview = (schedules, startIso, dayCount = 7) => {
    const days = [];
    for (let i = 0; i < dayCount; i += 1) {
        const date = addDaysIso(startIso, i);
        const seen = new Set();
        const entries = [];
        let holiday = null;

        for (const schedule of schedules) {
            const dayHoliday = resolveHoliday(date, schedule.publicByDate || {}, schedule.holidayOverrides);
            if (dayHoliday && !holiday) holiday = dayHoliday;
            for (const entry of schedule.entries) {
                if (!entryOccursOn(entry, date)) continue;
                if (dayHoliday && entry.skipOnHoliday) continue;
                // Someone who copied a friend's schedule can end up with the same class
                // twice. Count it once.
                const key = `${entry.title}|${entry.startTime}|${entry.endTime}`;
                if (seen.has(key)) continue;
                seen.add(key);
                entries.push({
                    title: entry.title,
                    kind: entry.kind,
                    startTime: entry.startTime,
                    endTime: entry.endTime,
                    location: entry.location || '',
                });
            }
        }

        entries.sort((a, b) => a.startTime.localeCompare(b.startTime));
        const range = (e) => [minutes(e.startTime), minutes(e.endTime)];
        const busy = unionMinutes(entries.map(range)) / 60;
        const classHours = unionMinutes(entries.filter((e) => e.kind === 'class').map(range)) / 60;
        days.push({
            date,
            holiday,
            classHours: round1(classHours),
            activityHours: round1(Math.max(busy - classHours, 0)),
            busyHours: round1(busy),
            entries,
        });
    }
    return days;
};
