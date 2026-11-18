import { describe, test, expect } from 'vitest';
import { heroState, inText, dayWord, examLine, whereText, classEntry, nextDateOf } from '../../client/src/utils/classHero.js';

// Local time, like the client: Wednesday 29 Oct 2025.
const at = (h, m = 0) => new Date(2025, 9, 29, h, m);

const klass = (startTime, endTime, extra = {}) => ({ kind: 'class', title: 'Databases', startTime, endTime, ...extra });
const on = (iso, entry) => ({ iso, entry });
const subject = { _id: 's1', name: 'Databases', code: 'DBMS 101' };
const times = [{ entryId: 'e1', days: [3] }];

describe('heroState', () => {
    test('no class times: none, whatever is upcoming', () => {
        expect(heroState([], [on('2025-10-29', klass('08:00', '09:30'))], at(8, 5))).toEqual({ state: 'none' });
    });

    test('class times but no class in the next two weeks: idle', () => {
        expect(heroState(times, [], at(8))).toEqual({ state: 'idle' });
        // Only an exam coming up is not a class.
        expect(heroState(times, [on('2025-10-30', { ...klass('08:00', '09:00'), kind: 'exam' })], at(8))).toEqual({ state: 'idle' });
    });

    test('on now, with the minutes left', () => {
        const entry = klass('08:00', '09:30');
        const hero = heroState(times, [on('2025-10-29', entry)], at(9, 5));
        expect(hero).toMatchObject({ state: 'now', iso: '2025-10-29', minutesLeft: 25 });
        expect(hero.entry).toBe(entry);
    });

    test('on now from the first minute, until the end minute', () => {
        const upcoming = [on('2025-10-29', klass('08:00', '09:30'))];
        expect(heroState(times, upcoming, at(8, 0)).state).toBe('now');
        expect(heroState(times, upcoming, at(9, 29))).toMatchObject({ state: 'now', minutesLeft: 1 });
        expect(heroState(times, upcoming, at(9, 30)).state).toBe('idle');
    });

    test('starts soon within 15 minutes, next from 16', () => {
        const upcoming = [on('2025-10-29', klass('10:00', '11:00'))];
        expect(heroState(times, upcoming, at(9, 48))).toMatchObject({ state: 'soon', minutesUntil: 12 });
        expect(heroState(times, upcoming, at(9, 45))).toMatchObject({ state: 'soon', minutesUntil: 15 });
        expect(heroState(times, upcoming, at(9, 44))).toMatchObject({ state: 'next', minutesUntil: 16, days: 0 });
    });

    test('a class that finished today is skipped for the next one', () => {
        const upcoming = [on('2025-10-29', klass('08:00', '09:00')), on('2025-10-31', klass('13:00', '16:00'))];
        expect(heroState(times, upcoming, at(10))).toMatchObject({ state: 'next', iso: '2025-10-31', days: 2 });
    });

    test('tomorrow morning at night: minutes run across midnight', () => {
        const hero = heroState(times, [on('2025-10-30', klass('08:00', '09:30'))], at(20));
        expect(hero).toMatchObject({ state: 'next', days: 1, minutesUntil: 12 * 60 });
    });

    test('of two classes on one day the earlier unfinished one wins, whatever the list order', () => {
        const upcoming = [on('2025-10-29', klass('15:00', '16:00')), on('2025-10-29', klass('13:00', '14:00'))];
        expect(heroState(times, upcoming, at(9)).entry.startTime).toBe('13:00');
    });
});

describe('hero words', () => {
    test('inText', () => {
        expect(inText({ minutesUntil: 40, days: 0 })).toBe('in 40 min');
        expect(inText({ minutesUntil: 18 * 60, days: 1 })).toBe('in 18 h');
        expect(inText({ minutesUntil: 1440 + 60, days: 1 })).toBe('in 1 day');
        expect(inText({ minutesUntil: 3 * 1440, days: 3 })).toBe('in 3 days');
    });

    test('dayWord', () => {
        const now = at(10);
        expect(dayWord('2025-10-29', now)).toBe('Today');
        expect(dayWord('2025-10-30', now)).toBe('Tomorrow');
        expect(dayWord('2025-10-31', now)).toBe('Friday');
        expect(dayWord('2025-11-05', now)).toBe('Wed, Nov 5');
    });
});

describe('examLine', () => {
    const exam = (title, date, extra = {}) => on(date, { kind: 'exam', title, startTime: '13:00', endTime: '14:30', ...extra });

    test('the nearest exam within two weeks, named by the part before the colon', () => {
        const line = examLine([exam('Final: Databases', '2025-11-12'), exam('Midterm: Databases', '2025-11-04')], subject, at(10));
        expect(line).toMatchObject({ iso: '2025-11-04', days: 6, label: 'Midterm' });
        expect(line.entry.title).toBe('Midterm: Databases');
    });

    test('an exam named like the subject is just "Exam"', () => {
        expect(examLine([exam('Databases', '2025-11-04')], subject, at(10)).label).toBe('Exam');
        expect(examLine([exam('DBMS 101', '2025-11-04')], subject, at(10)).label).toBe('Exam');
    });

    test('none for no exam, one past two weeks, or one that already finished today', () => {
        expect(examLine([], subject, at(10))).toBeNull();
        expect(examLine([exam('Final', '2025-11-20')], subject, at(10))).toBeNull();
        expect(examLine([exam('Quiz', '2025-10-29')], subject, at(15))).toBeNull();
        expect(examLine([exam('Quiz', '2025-10-29')], subject, at(14))).toMatchObject({ days: 0 });
    });

    test('classes are ignored', () => {
        expect(examLine([on('2025-10-30', klass('08:00', '09:00'))], subject, at(10))).toBeNull();
    });
});

describe('class time helpers', () => {
    test('whereText', () => {
        expect(whereText({ isMain: true, canEdit: true, scheduleTitle: 'My 1st Sem' })).toBe('');
        expect(whereText({ isMain: false, canEdit: true, scheduleTitle: 'Study group' })).toBe('On Study group');
        expect(whereText({ isMain: false, canEdit: false, scheduleTitle: 'Org officers' })).toBe('From Org officers');
    });

    test('classEntry names the subject and keeps where the time lives', () => {
        const time = { entryId: 'e1', scheduleId: 'sc1', days: [1], startTime: '08:00', endTime: '09:00' };
        expect(classEntry(time, subject)).toMatchObject({ entryId: 'e1', scheduleId: 'sc1', title: 'Databases', kind: 'class', subject: 's1' });
    });

    test('nextDateOf: today when it meets today, else the next day it does', () => {
        expect(nextDateOf({ days: [3] }, at(10))).toBe('2025-10-29');
        expect(nextDateOf({ days: [5] }, at(10))).toBe('2025-10-31');
        expect(nextDateOf({ days: [1] }, at(10))).toBe('2025-11-03');
    });

    test('nextDateOf: a one-off date, a window that has not started, and a time with no day soon', () => {
        expect(nextDateOf({ days: [], date: '2025-11-06' }, at(10))).toBe('2025-11-06');
        expect(nextDateOf({ days: [3], startDate: '2025-11-10' }, at(10))).toBe('2025-11-12');
        expect(nextDateOf({ days: [], date: '2025-10-01' }, at(10))).toBe('2025-10-29');
    });
});
