import { describe, test, expect } from 'vitest';
import { buildWeek, heaviestDay, hoursLeftToday, REST_BUFFER } from '../../client/src/utils/workload.js';

// Roadmap 13b: a task's weight shows on its due day, prep for a later deadline is kept apart, today only
// counts the hours left before bed, and ties for "heaviest" go to the day with more work due on it.
const at = (h, m = 0) => new Date(2026, 10, 15, h, m); // Sunday 15 Nov 2026
const iso = (offset) => {
    const d = new Date(2026, 10, 15 + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const profile = { studyHoursPerDay: 4, wellbeingGoal: 'steady', hasRegularSleepSchedule: true, usualSleepStart: '23:00' };
// Sizes as the task form saves them: Medium is 3 h, Large 5 h.
const task = (id, offset, hours) => ({ _id: id, title: id, course: 'CS', dueDate: iso(offset), hours, difficulty: 3, importance: 3 });
const mediumTodayLargeTomorrow = [task('medium', 0, 3), task('large1', 1, 5), task('large2', 1, 5), task('large3', 1, 5)];
const emptyDay = { entries: [], busyHours: 0 };

describe('the heaviest day', () => {
    test.each([[10, 0], [19, 30], [22, 30]])('1 medium task today and 3 large tomorrow makes tomorrow heaviest at %i:%i', (h, m) => {
        const week = buildWeek(mediumTodayLargeTomorrow, profile, null, at(h, m));
        expect(heaviestDay(week)).toEqual({ key: iso(1), name: 'Monday' });
    });

    test('a tie goes to the day with more work due on it, not the earlier day', () => {
        const day = (key, due, prep) => ({ key, busyHours: 0, load: due + prep, due, prep });
        const week = [day(iso(0), 1, 3), day(iso(1), 4, 0), day(iso(2), 0, 1)];
        expect(heaviestDay(week).key).toBe(iso(1));
    });

    test('an equal tie on due work still goes to the earlier day, and an empty week has none', () => {
        const day = (key) => ({ key, busyHours: 0, load: 2, due: 2, prep: 0 });
        expect(heaviestDay([day(iso(0)), day(iso(1))])).toEqual({ key: iso(0), name: 'Today' });
        expect(heaviestDay([{ key: iso(0), busyHours: 0, load: 0, due: 0, prep: 0 }])).toBeNull();
    });
});

describe('due work and prep', () => {
    test('the share on the due day is due work, earlier shares are prep, and nothing lands after the due date', () => {
        const tasks = [task('a', 3, 6), task('b', 5, 4), task('later', 12, 8), task('late', -2, 2)];
        const week = buildWeek(tasks, profile, null, at(9));
        const dueIndex = { a: 3, b: 5, later: 12, late: 0 };
        week.forEach((day, i) => {
            day.items.forEach((item) => {
                expect(i).toBeLessThanOrEqual(dueIndex[item.title]);
                expect(item.prep).toBe(i < dueIndex[item.title]);
            });
            // Each is rounded to 0.1 h on its own.
            expect(Math.abs(day.load - (day.due + day.prep))).toBeLessThanOrEqual(0.11);
        });
        // Overdue work is due today, never prep.
        expect(week[0].items.find((item) => item.title === 'late').prep).toBe(false);
        // A deadline past the week only adds prep to it.
        expect(week.flatMap((d) => d.items).filter((item) => item.title === 'later').every((item) => item.prep)).toBe(true);
    });

    test('every hour of a task is placed once, split between its due day and the days before', () => {
        const week = buildWeek([task('a', 4, 6)], profile, null, at(9));
        const placed = week.flatMap((d) => d.items).reduce((sum, item) => sum + item.hours, 0);
        expect(placed).toBeCloseTo(6, 0);
        expect(week[4].due).toBeGreaterThan(0);
        expect(week.slice(5).every((d) => d.load === 0)).toBe(true);
    });
});

describe('hours left today', () => {
    test('the morning keeps the usual study hours, late evening has almost no room', () => {
        expect(buildWeek([], profile, null, at(9))[0].capacity).toBe(4);
        expect(buildWeek([], profile, null, at(20, 30))[0].capacity).toBe(0.5);
        expect(buildWeek([], profile, null, at(21, 30))[0].capacity).toBe(0);
        // Other days keep their full room.
        expect(buildWeek([], profile, null, at(21, 30))[1].capacity).toBe(4);
    });

    test('is the time until bed minus the rest buffer', () => {
        expect(hoursLeftToday(profile, emptyDay, at(19, 30))).toBe(3.5 - REST_BUFFER);
    });

    test('with no bedtime, or an irregular one, the day ends at 23:00', () => {
        expect(hoursLeftToday({}, emptyDay, at(19))).toBe(2);
        expect(hoursLeftToday({ usualSleepStart: 'late' }, emptyDay, at(19))).toBe(2);
        expect(hoursLeftToday({ hasRegularSleepSchedule: false, usualSleepStart: '01:00' }, emptyDay, at(19))).toBe(2);
    });

    test('a bedtime after midnight still belongs to tonight', () => {
        const owl = { ...profile, usualSleepStart: '01:30' };
        expect(hoursLeftToday(owl, emptyDay, at(21))).toBe(2.5);
        // Just after midnight, before that bedtime, there is still time left.
        expect(hoursLeftToday(owl, emptyDay, new Date(2026, 10, 15, 0, 30))).toBeGreaterThan(20);
    });

    test('past bedtime there is no room, and work due today still lands on today', () => {
        expect(hoursLeftToday(profile, emptyDay, at(23, 30))).toBe(0);
        const [today] = buildWeek([task('a', 0, 3)], profile, null, at(23, 30));
        expect(today.capacity).toBe(0);
        expect(today.due).toBe(3);
    });

    test('classes still ahead today take their time out, finished ones do not', () => {
        const day = {
            busyHours: 3,
            entries: [
                { kind: 'class', startTime: '08:00', endTime: '10:00' },
                { kind: 'class', startTime: '17:00', endTime: '18:00' },
            ],
        };
        // 16:00 to 23:00 is 7 h, minus 1 h of class still ahead, minus the rest buffer.
        expect(hoursLeftToday(profile, day, at(16))).toBe(6 - REST_BUFFER);
        // Halfway through the class only the rest of it counts.
        expect(hoursLeftToday(profile, day, at(17, 30))).toBe(5 - REST_BUFFER);
    });
});
