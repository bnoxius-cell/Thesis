import { describe, test, expect } from 'vitest';
import { monthWeeks, monthOfWeek, toISODate } from '../../client/src/utils/scheduleUtils.js';

const mondays = (year, month) => monthWeeks(new Date(year, month, 1)).map(toISODate);
const monthKey = (d) => toISODate(d).slice(0, 7);

describe('monthWeeks (Thursday rule)', () => {
    test('October 2026 has 5 weeks, from Sep 28', () => {
        expect(mondays(2026, 9)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
    });

    test('November 2026 has 4 weeks, from Nov 2', () => {
        expect(mondays(2026, 10)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
    });

    test('February 2027 has 4 weeks, from Feb 1', () => {
        expect(mondays(2027, 1)).toEqual(['2027-02-01', '2027-02-08', '2027-02-15', '2027-02-22']);
    });

    test('December 2026 ends in a week that runs into January 2027', () => {
        const weeks = mondays(2026, 11);
        expect(weeks).toEqual(['2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28']);
    });

    test('January 2027 starts after that week', () => {
        expect(mondays(2027, 0)).toEqual(['2027-01-04', '2027-01-11', '2027-01-18', '2027-01-25']);
    });

    test('every week appears in exactly one month across a year change', () => {
        const seen = new Map();
        for (let m = 0; m < 24; m += 1) {
            monthWeeks(new Date(2026, m, 1)).forEach((monday) => {
                const key = toISODate(monday);
                expect(seen.has(key)).toBe(false);
                seen.set(key, m);
            });
        }
        // Consecutive Mondays, no gaps.
        const all = [...seen.keys()];
        for (let i = 1; i < all.length; i += 1) {
            const gap = (new Date(all[i]) - new Date(all[i - 1])) / 86400000;
            expect(gap).toBe(7);
        }
    });

    test('a month always has 4 or 5 weeks', () => {
        for (let m = 0; m < 36; m += 1) {
            const n = monthWeeks(new Date(2025, m, 1)).length;
            expect([4, 5]).toContain(n);
        }
    });
});

describe('monthOfWeek', () => {
    test('any day in a week maps to the month of its Thursday', () => {
        expect(monthKey(monthOfWeek(new Date(2026, 8, 28)))).toBe('2026-10'); // Mon Sep 28, its Thursday is Oct 1
        expect(monthKey(monthOfWeek(new Date(2026, 9, 1)))).toBe('2026-10');
        expect(monthKey(monthOfWeek(new Date(2026, 10, 1)))).toBe('2026-10'); // Sun Nov 1 is still in the Oct 26 week
        expect(monthKey(monthOfWeek(new Date(2026, 10, 2)))).toBe('2026-11');
    });

    test('a week that spans a year change belongs to the Thursday\'s month', () => {
        expect(monthKey(monthOfWeek(new Date(2026, 11, 31)))).toBe('2026-12'); // Thu Dec 31
        expect(monthKey(monthOfWeek(new Date(2027, 0, 3)))).toBe('2026-12'); // Sun Jan 3, week of Dec 28
        expect(monthKey(monthOfWeek(new Date(2027, 0, 4)))).toBe('2027-01');
    });

    test('monthOfWeek of each shown Monday is the month that lists it', () => {
        for (let m = 0; m < 24; m += 1) {
            const month = new Date(2026, m, 1);
            monthWeeks(month).forEach((monday) => {
                expect(toISODate(monthOfWeek(monday))).toBe(toISODate(month));
            });
        }
    });
});
