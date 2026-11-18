import { describe, test, expect } from 'vitest';
import {
    addNextDay, changeDayTime, dayTimeRows, groupTimes, inWeekOrder, nextFreeDay, setDays, setSameTime, timeProblem,
} from '../../client/src/utils/classTimes.js';
import { clashNote, emptyEntryForm, entryErrors, entryPayloads } from '../../client/src/utils/entryForm.js';
import { classTimesBody, emptyClassTime, scheduleSummary, timeErrors } from '../../client/src/features/study/term/newTermForm.js';

const MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6, SUN = 0;

// Mon 7-12, Tue 9-14, Wed 8-13: a different time on each day.
const perDay = (extra = {}) => ({
    days: [MON, TUE, WED],
    startTime: '07:00',
    endTime: '12:00',
    sameTime: false,
    dayTimes: {
        [MON]: { startTime: '07:00', endTime: '12:00' },
        [TUE]: { startTime: '09:00', endTime: '14:00' },
        [WED]: { startTime: '08:00', endTime: '13:00' },
    },
    ...extra,
});

describe('class times with a time for each day', () => {
    test('days come Monday first, Sunday last', () => {
        expect(inWeekOrder([SUN, WED, MON, SAT])).toEqual([MON, WED, SAT, SUN]);
    });

    test('one row per picked day, Monday first, a day without its own times uses the shared ones', () => {
        const time = { days: [WED, MON], startTime: '08:00', endTime: '09:30', sameTime: false, dayTimes: { [MON]: { startTime: '07:00', endTime: '12:00' } } };
        expect(dayTimeRows(time)).toEqual([
            { day: MON, startTime: '07:00', endTime: '12:00' },
            { day: WED, startTime: '08:00', endTime: '09:30' },
        ]);
    });

    test('turning the switch off gives every day the shared time, turning it on keeps the first day', () => {
        const same = { days: [WED, MON], startTime: '08:00', endTime: '09:30', sameTime: true, dayTimes: {} };
        const split = setSameTime(same, false);
        expect(split.sameTime).toBe(false);
        expect(split.dayTimes).toEqual({ [MON]: { startTime: '08:00', endTime: '09:30' }, [WED]: { startTime: '08:00', endTime: '09:30' } });
        const back = setSameTime(changeDayTime(split, MON, { startTime: '07:00', endTime: '12:00' }), true);
        expect(back).toMatchObject({ sameTime: true, dayTimes: {}, startTime: '07:00', endTime: '12:00' });
    });

    test('picking a day copies the last row, unpicking one drops its times', () => {
        const picked = setDays(perDay(), [MON, TUE, WED, FRI]);
        expect(picked.dayTimes[FRI]).toEqual({ startTime: '08:00', endTime: '13:00' });
        expect(picked.dayTimes[TUE]).toEqual({ startTime: '09:00', endTime: '14:00' });
        const unpicked = setDays(picked, [MON, WED]);
        expect(Object.keys(unpicked.dayTimes).sort()).toEqual([String(MON), String(WED)]);
        expect(setDays({ days: [MON], startTime: '08:00', endTime: '09:00', sameTime: true, dayTimes: {} }, [MON, TUE]).dayTimes).toEqual({});
    });

    test('"Add another day" takes the next free weekday and copies the last row onto it', () => {
        const added = addNextDay(perDay());
        expect(added.days).toEqual([MON, TUE, WED, THU]);
        expect(added.dayTimes[THU]).toEqual({ startTime: '08:00', endTime: '13:00' });
        // Mon and Wed picked: Thursday comes after the last picked day, not the gap on Tuesday
        expect(nextFreeDay([MON, WED])).toBe(THU);
        expect(nextFreeDay([MON, SUN])).toBe(TUE); // nothing free after Sunday: the first free day of the week
        expect(nextFreeDay([])).toBe(MON);
        expect(nextFreeDay([MON, TUE, WED, THU, FRI, SAT, SUN])).toBeUndefined();
        const full = perDay({ days: [MON, TUE, WED, THU, FRI, SAT, SUN] });
        expect(addNextDay(full)).toBe(full);
    });

    test('groups days that share a time into one entry', () => {
        expect(groupTimes(perDay())).toEqual([
            { days: [MON], startTime: '07:00', endTime: '12:00' },
            { days: [TUE], startTime: '09:00', endTime: '14:00' },
            { days: [WED], startTime: '08:00', endTime: '13:00' },
        ]);
        const merged = changeDayTime(perDay(), WED, { startTime: '07:00', endTime: '12:00' });
        expect(groupTimes(merged)).toEqual([
            { days: [MON, WED], startTime: '07:00', endTime: '12:00' },
            { days: [TUE], startTime: '09:00', endTime: '14:00' },
        ]);
        expect(groupTimes({ days: [FRI, MON], startTime: '08:00', endTime: '09:00', sameTime: true })).toEqual([
            { days: [MON, FRI], startTime: '08:00', endTime: '09:00' },
        ]);
        // a time from before the switch existed has no sameTime and shares one time
        expect(groupTimes({ days: [MON, TUE], startTime: '08:00', endTime: '09:00' })).toHaveLength(1);
    });

    test('the error names the day and says which row to mark', () => {
        expect(timeProblem(perDay())).toBeNull();
        const wed = changeDayTime(perDay(), WED, { endTime: '07:00' });
        expect(timeProblem(wed)).toEqual({ day: WED, message: 'Wednesday ends before it starts. Pick a later end time.' });
        expect(timeProblem(changeDayTime(perDay(), TUE, { startTime: '' }))).toEqual({ day: TUE, message: 'Set a start and an end time for Tuesday.' });
        expect(timeProblem({ startTime: '09:00', endTime: '09:00', sameTime: true })).toEqual({ day: null, message: 'The end time must be after the start time.' });
        expect(timeProblem({ startTime: '', endTime: '09:00' })).toEqual({ day: null, message: 'Set a start and an end time.' });
    });
});

describe('the Plan class time form with a time for each day', () => {
    const form = (extra) => ({ ...emptyEntryForm('class'), subject: 'subj1', title: 'Networking', location: ' Rm   305 ', ...perDay(), ...extra });

    test('adds one entry per distinct pair of times, with the room and days on each', () => {
        const bodies = entryPayloads(form());
        expect(bodies).toHaveLength(3);
        expect(bodies.map((body) => [body.days, body.startTime, body.endTime])).toEqual([
            [[MON], '07:00', '12:00'],
            [[TUE], '09:00', '14:00'],
            [[WED], '08:00', '13:00'],
        ]);
        for (const body of bodies) expect(body).toMatchObject({ kind: 'class', subject: 'subj1', title: 'Networking', location: 'Rm 305', date: '' });
    });

    test('a shared time is still one entry, and the per-day fields never reach the server', () => {
        const [body] = entryPayloads({ ...form(), sameTime: true, dayTimes: {}, days: [MON, WED], startTime: '08:00', endTime: '09:30' });
        expect(entryPayloads({ ...form(), sameTime: true, days: [MON, WED] })).toHaveLength(1);
        expect(body.days).toEqual([MON, WED]);
        expect(body).not.toHaveProperty('sameTime');
        expect(body).not.toHaveProperty('dayTimes');
    });

    test('a bad day blocks the save and its message names the day', () => {
        expect(entryErrors(form(), { bySubject: true })).toEqual({});
        const bad = form(changeDayTime(perDay(), WED, { endTime: '07:00' }));
        expect(entryErrors(bad, { bySubject: true }).times).toBe('Wednesday ends before it starts. Pick a later end time.');
        expect(entryErrors({ ...bad, days: [], dayTimes: {} }, { bySubject: true }).days).toBe('Pick at least one day.');
    });

    test('the clash note looks at each day', () => {
        const existing = [{ _id: 'e1', kind: 'class', title: 'Web Systems', days: [TUE], startTime: '13:00', endTime: '15:00', date: '' }];
        expect(clashNote(form(), existing)).toBe('Overlaps Web Systems, Tue 1:00 pm. You can still add it.');
        expect(clashNote(form(changeDayTime(perDay(), TUE, { startTime: '15:00', endTime: '16:00' })), existing)).toBe('');
    });
});

describe('subject class times with a time for each day', () => {
    const subject = (time) => ({ key: 's1', name: 'Databases', code: '', classTimes: [{ ...emptyClassTime(), location: ' Lab  2 ', ...time }] });

    test('send one class time per distinct pair of times, all with the room', () => {
        const body = classTimesBody(subject(perDay()));
        expect(body).toEqual([
            { days: [MON], startTime: '07:00', endTime: '12:00', location: 'Lab 2' },
            { days: [TUE], startTime: '09:00', endTime: '14:00', location: 'Lab 2' },
            { days: [WED], startTime: '08:00', endTime: '13:00', location: 'Lab 2' },
        ]);
    });

    test('a class time with one shared time sends what it always sent', () => {
        expect(classTimesBody(subject({ days: [WED, MON], startTime: '08:00', endTime: '09:30' }))).toEqual([
            { days: [MON, WED], startTime: '08:00', endTime: '09:30', location: 'Lab 2' },
        ]);
    });

    test('a bad day names itself, and too many different times count against the six', () => {
        const [time] = subject(changeDayTime(perDay(), TUE, { endTime: '08:00' })).classTimes;
        expect(timeErrors(subject(time))).toEqual({ [time.key]: 'Tuesday ends before it starts. Pick a later end time.' });

        const week = perDay({ days: [MON, TUE, WED, THU, FRI, SAT, SUN], dayTimes: Object.fromEntries([MON, TUE, WED, THU, FRI, SAT, SUN].map((day, index) => [day, { startTime: `0${index + 1}:00`, endTime: `1${index}:00` }])) });
        const full = subject(week);
        expect(timeErrors(full)[full.classTimes[0].key]).toMatch(/up to 6 different class times/);
        expect(timeErrors(subject(perDay()))).toEqual({});
    });

    test('the review summary lists each distinct time', () => {
        expect(scheduleSummary(subject(perDay()))).toBe('Mon 7:00 am · Tue 9:00 am · Wed 8:00 am');
    });
});
