import { describe, test, expect } from 'vitest';
import {
    emptyEntryForm, entryFormFrom, entryPayload, entryErrors, entryStarted, linkError, clashNote, titleAfterSubject,
} from '../../client/src/utils/entryForm.js';

const TODAY = new Date(2026, 10, 9); // Mon 2026-11-09

const stored = {
    _id: 'e1', title: 'Web Systems', kind: 'class', days: [2, 4], date: '', startDate: '2026-08-10', endDate: '2026-12-12',
    startTime: '13:00', endTime: '15:00', location: 'Rm 305', meetingUrl: '', notes: '', color: '#3f5ba9', icon: 'code',
    image: 'data:image/png;base64,AAAA', skipOnHoliday: false, prepHours: 0,
};

describe('emptyEntryForm', () => {
    test('classes and activities repeat weekly, events and exams are one day', () => {
        expect(emptyEntryForm('class', TODAY).repeat).toBe('weekly');
        expect(emptyEntryForm('activity', TODAY).repeat).toBe('weekly');
        expect(emptyEntryForm('event', TODAY).repeat).toBe('once');
        expect(emptyEntryForm('exam', TODAY)).toMatchObject({ repeat: 'once', date: '2026-11-09', prepHours: 4 });
    });
});

describe('entryPayload', () => {
    test('round trip keeps image, colour, icon and skipOnHoliday: false, and drops _id', () => {
        const payload = entryPayload({ ...entryFormFrom(stored), location: 'Lab 4' }, stored);
        expect(payload).toMatchObject({
            title: 'Web Systems', kind: 'class', days: [2, 4], date: '', location: 'Lab 4', startTime: '13:00', endTime: '15:00',
            color: '#3f5ba9', icon: 'code', image: 'data:image/png;base64,AAAA', skipOnHoliday: false,
            startDate: '2026-08-10', endDate: '2026-12-12',
        });
        expect(payload).not.toHaveProperty('_id');
        expect(payload).not.toHaveProperty('prepHours');
    });

    test('a new class sends only the form: weekly days sorted, no date', () => {
        const form = { ...emptyEntryForm('class', TODAY), title: '  Data   Mining ', days: [3, 1], location: ' Room 101 ' };
        expect(entryPayload(form)).toEqual({
            kind: 'class', title: 'Data Mining', startTime: '09:00', endTime: '10:00', location: 'Room 101',
            meetingUrl: '', notes: '', date: '', days: [1, 3],
        });
    });

    test('an exam is one day, with prep hours as a number', () => {
        const form = { ...emptyEntryForm('exam', TODAY), title: 'Finals', date: '2026-11-13', prepHours: '6' };
        expect(entryPayload(form)).toMatchObject({ kind: 'exam', date: '2026-11-13', days: [], prepHours: 6 });
    });

    test('switching a weekly entry to one day clears its days and term dates', () => {
        const form = { ...entryFormFrom(stored), repeat: 'once', date: '2026-11-20' };
        expect(entryPayload(form, stored)).toMatchObject({ date: '2026-11-20', days: [], startDate: '', endDate: '', color: '#3f5ba9' });
    });
});

describe('entryErrors', () => {
    const ok = { ...emptyEntryForm('class', TODAY), title: 'Data Mining', days: [1] };

    test('a complete form has none', () => expect(entryErrors(ok)).toEqual({}));
    test('title, days and times use the server wording', () => {
        expect(entryErrors({ ...ok, title: ' ' }).title).toBe('A title is required.');
        expect(entryErrors({ ...ok, title: 'x'.repeat(81) }).title).toBe('The title is too long (80 characters max).');
        expect(entryErrors({ ...ok, days: [] }).days).toBe('Pick at least one day.');
        expect(entryErrors({ ...ok, endTime: '09:00' }).times).toBe('The end time must be after the start time.');
        expect(entryErrors({ ...ok, startTime: '' }).times).toBe('Start and end times are required.');
    });
    test('an exam needs a real date and 0 to 40 study hours', () => {
        const exam = { ...emptyEntryForm('exam', TODAY), title: 'Finals' };
        expect(entryErrors({ ...exam, date: '' }).date).toBe('An exam needs a date.');
        expect(entryErrors({ ...exam, date: '2026-02-31' }).date).toBe('That date is not valid.');
        expect(entryErrors({ ...exam, prepHours: 41 }).prepHours).toBe('Study hours for an exam can be 0 to 40.');
        expect(entryErrors({ ...exam, prepHours: 0 })).toEqual({});
    });
    test('the meeting link must be a full web address', () => {
        expect(linkError('meet.google')).toMatch(/full web address/);
        expect(linkError('https://meet.google.com/abc-defg-hij')).toBe('');
        expect(linkError('  ')).toBe('');
        expect(entryErrors({ ...ok, meetingUrl: 'meet.google' }).meetingUrl).toMatch(/full web address/);
    });
});

describe('form helpers', () => {
    test('entryStarted ignores the subject pick and notices a change', () => {
        const start = emptyEntryForm('class', TODAY);
        expect(entryStarted({ ...start, subject: 'Networking' }, start)).toBe(false);
        expect(entryStarted({ ...start, title: 'x' }, start)).toBe(true);
    });
    test('a subject fills the title only while the title is empty or the previous pick', () => {
        expect(titleAfterSubject('', '', 'Networking')).toBe('Networking');
        expect(titleAfterSubject('Networking', 'Networking', 'Web Systems')).toBe('Web Systems');
        expect(titleAfterSubject('My lab', 'Networking', 'Web Systems')).toBe('My lab');
    });
});

describe('clashNote', () => {
    const existing = [{ ...stored }];
    const form = { ...emptyEntryForm('class', TODAY), title: 'Capstone', days: [2], startTime: '13:30', endTime: '14:30' };

    test('names the entry it overlaps, with its day and time', () => {
        expect(clashNote(form, existing)).toBe('Overlaps Web Systems, Tue 1:00 pm. You can still add it.');
    });
    test('a one-day exam clashes on its weekday', () => {
        const exam = { ...emptyEntryForm('exam', TODAY), title: 'Quiz', date: '2026-11-10', startTime: '14:00', endTime: '15:00' };
        expect(clashNote(exam, existing)).toMatch(/^Overlaps Web Systems, Tue 1:00 pm/);
    });
    test('quiet when nothing overlaps or the form is incomplete', () => {
        expect(clashNote({ ...form, days: [1] }, existing)).toBe('');
        expect(clashNote({ ...form, days: [] }, existing)).toBe('');
        expect(clashNote({ ...form, endTime: '13:00' }, existing)).toBe('');
        expect(clashNote(form, [])).toBe('');
    });
});
