import { describe, test, expect } from 'vitest';
import {
    taskHref,
    subjectHref,
    planDayHref,
    taskSubject,
    entrySubject,
    entryIsLive,
    repeatText,
} from '../../client/src/features/details/itemLinks.js';
import { sizeText, taskChip, timeSpan, entryChip, entrySubtitle } from '../../client/src/features/details/detailText.js';

const subjects = [
    { _id: 's1', name: 'Information Assurance', code: 'IT 301' },
    { _id: 's2', name: 'Math', code: 'MATH 1' },
    { _id: 's3', name: 'Discrete Math', code: 'MATH 2' },
];

// Local time, like the client: Wednesday 29 Oct 2025, 10:30.
const now = new Date(2025, 9, 29, 10, 30);

describe('item links', () => {
    test('task and subject links', () => {
        expect(taskHref('abc')).toBe('/plan?view=tasks&task=abc');
        expect(subjectHref('s1')).toBe('/study/subjects/s1');
    });

    test('a day in the current week leaves out ?week=', () => {
        expect(planDayHref('2025-10-30', now)).toBe('/plan?day=2025-10-30');
    });

    test('a day in another week names that Monday', () => {
        expect(planDayHref('2025-11-05', now)).toBe('/plan?week=2025-11-03&day=2025-11-05');
        expect(planDayHref('2025-10-26', now)).toBe('/plan?week=2025-10-20&day=2025-10-26');
    });
});

describe('subject matching', () => {
    test('a task matches by subject id, else by its course text', () => {
        expect(taskSubject({ subject: 's2', course: 'whatever' }, subjects)._id).toBe('s2');
        expect(taskSubject({ course: 'it301' }, subjects)._id).toBe('s1');
        expect(taskSubject({ course: '' }, subjects)).toBeNull();
        expect(taskSubject({ subject: 'gone', course: 'Nothing' }, subjects)).toBeNull();
    });

    test('a class matches by its title', () => {
        expect(entrySubject({ kind: 'class', title: 'Information Assurance' }, subjects)._id).toBe('s1');
        expect(entrySubject({ kind: 'class', title: 'Officers meeting' }, subjects)).toBeNull();
    });

    test('an exam also matches by the subject name or code as whole words', () => {
        expect(entrySubject({ kind: 'exam', title: 'Midterm: Information Assurance' }, subjects)._id).toBe('s1');
        expect(entrySubject({ kind: 'exam', title: 'Quiz for IT 301' }, subjects)._id).toBe('s1');
    });

    test('an exam does not match part of a word, and the longest match wins', () => {
        expect(entrySubject({ kind: 'exam', title: 'Mathematics finals' }, subjects)).toBeNull();
        expect(entrySubject({ kind: 'exam', title: 'Midterm: Discrete Math' }, subjects)._id).toBe('s3');
    });

    test('events and activities have no subject', () => {
        expect(entrySubject({ kind: 'event', title: 'Information Assurance' }, subjects)).toBeNull();
        expect(entrySubject({ kind: 'activity', title: 'Math' }, subjects)).toBeNull();
    });
});

describe('entryIsLive', () => {
    const entry = { startTime: '10:00', endTime: '11:00' };

    test('the start minute counts and the end minute does not', () => {
        expect(entryIsLive(entry, '2025-10-29', new Date(2025, 9, 29, 10, 0))).toBe(true);
        expect(entryIsLive(entry, '2025-10-29', new Date(2025, 9, 29, 10, 59))).toBe(true);
        expect(entryIsLive(entry, '2025-10-29', new Date(2025, 9, 29, 11, 0))).toBe(false);
        expect(entryIsLive(entry, '2025-10-29', new Date(2025, 9, 29, 9, 59))).toBe(false);
    });

    test('another day is never live', () => {
        expect(entryIsLive(entry, '2025-10-30', now)).toBe(false);
    });
});

describe('detail text', () => {
    test('repeatText lists weekdays Monday first', () => {
        expect(repeatText([4, 2])).toBe('Every Tue and Thu');
        expect(repeatText([5, 1, 3])).toBe('Every Mon, Wed and Fri');
        expect(repeatText([0])).toBe('Every Sun');
        expect(repeatText([])).toBe('');
        expect(repeatText(undefined)).toBe('');
    });

    test('timeSpan shares am or pm only when both ends do', () => {
        expect(timeSpan('09:00', '11:00')).toBe('9:00 to 11:00 am');
        expect(timeSpan('11:00', '13:00')).toBe('11:00 am to 1:00 pm');
        expect(timeSpan('00:30', '12:00')).toBe('12:30 am to 12:00 pm');
    });

    test('sizeText names the size and the hours', () => {
        expect(sizeText(1)).toBe('Small, about 1 hour');
        expect(sizeText(3)).toBe('Medium, about 3 hours');
        expect(sizeText(6)).toBe('Large, about 6 hours');
        expect(sizeText(0)).toBe('');
    });

    test('taskChip says how close the due day is', () => {
        const due = (iso, extra = {}) => ({ dueDate: `${iso}T00:00:00.000Z`, ...extra });
        expect(taskChip(due('2025-10-29'), now)).toEqual({ label: 'Due today', tone: 'watch' });
        expect(taskChip(due('2025-10-30'), now)).toEqual({ label: 'Due tomorrow', tone: 'watch' });
        expect(taskChip(due('2025-11-03'), now)).toEqual({ label: 'Due Mon, Nov 3', tone: 'neutral' });
        expect(taskChip(due('2025-10-28'), now)).toEqual({ label: 'Overdue, was due Tue', tone: 'danger' });
        expect(taskChip(due('2025-10-01'), now)).toEqual({ label: 'Overdue, was due Oct 1', tone: 'danger' });
        expect(taskChip(due('2025-10-28', { isCompleted: true }), now)).toBeNull();
    });

    test('entryChip and entrySubtitle', () => {
        const cls = { kind: 'class', startTime: '13:00', endTime: '14:00' };
        expect(entryChip(cls, '2025-10-29', now, true)).toEqual({ label: 'On now', tone: 'good' });
        expect(entryChip(cls, '2025-10-29', now, false)).toEqual({ label: 'Today, 1:00 pm', tone: 'watch' });
        expect(entryChip({ ...cls, startTime: '08:00', endTime: '09:00' }, '2025-10-29', now, false)).toEqual({ label: 'Finished', tone: 'neutral' });
        expect(entryChip(cls, '2025-10-28', now, false)).toBeNull();
        expect(entrySubtitle(cls, '2025-10-29', 'Every Tue and Thu')).toBe('Class · Every Tue and Thu');
        expect(entrySubtitle({ kind: 'exam' }, '2025-11-01', '')).toBe('Exam · Sat, Nov 1');
    });
});
