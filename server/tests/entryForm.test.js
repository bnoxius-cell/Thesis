import { describe, test, expect } from 'vitest';
import {
    emptyEntryForm, entryFormFrom, entryPayload, entryErrors, entryStarted, linkError, clashNote, titleAfterSubject, subjectNameOf,
} from '../../client/src/utils/entryForm.js';
import { NEW_SUBJECT } from '../../client/src/features/study/subjectForm.js';

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

describe('entryPayload subject', () => {
    const linked = { ...stored, subject: 's1' };

    test('the form reads the stored subject id and a round trip sends it back', () => {
        const form = entryFormFrom(linked);
        expect(form.subject).toBe('s1');
        expect(entryPayload(form, linked).subject).toBe('s1');
    });

    test('a new pick replaces the stored id; clearing it sends null on a stored link only', () => {
        expect(entryPayload({ ...entryFormFrom(linked), subject: 's2' }, linked).subject).toBe('s2');
        expect(entryPayload({ ...entryFormFrom(linked), subject: '' }, linked).subject).toBeNull();
        expect(entryPayload({ ...entryFormFrom(stored), subject: '' }, stored)).not.toHaveProperty('subject');
    });

    test('exams send it, events and activities never do', () => {
        const exam = { ...emptyEntryForm('exam', TODAY), title: 'Finals', subject: 's1' };
        expect(entryPayload(exam).subject).toBe('s1');
        const event = { ...emptyEntryForm('event', TODAY), title: 'Party', subject: 's1' };
        expect(entryPayload(event, linked)).not.toHaveProperty('subject');
    });
});

describe('new subject', () => {
    const made = (kind, overrides = {}) => ({
        ...emptyEntryForm(kind, TODAY), title: 'Data Mining', subject: NEW_SUBJECT, newSubjectName: '  Data   Mining ', days: [1], ...overrides,
    });

    test('a class or exam sends newSubject (cleaned) and no subject', () => {
        for (const kind of ['class', 'exam']) {
            const payload = entryPayload(made(kind));
            expect(payload.newSubject).toBe('Data Mining');
            expect(payload).not.toHaveProperty('subject');
        }
    });

    test('it replaces the subject an edited entry already had', () => {
        const linked = { ...stored, subject: 's1' };
        const payload = entryPayload({ ...entryFormFrom(linked), subject: NEW_SUBJECT, newSubjectName: 'Statistics' }, linked);
        expect(payload).toMatchObject({ newSubject: 'Statistics' });
        expect(payload).not.toHaveProperty('subject');
    });

    test('an empty name is an error, for a class and an exam', () => {
        for (const kind of ['class', 'exam']) {
            expect(entryErrors(made(kind, { newSubjectName: '   ' })).newSubject).toBe('Give the subject a name.');
            expect(entryErrors(made(kind)).newSubject).toBeUndefined();
        }
    });

    test('an event or activity never sends it or asks for the name', () => {
        for (const kind of ['event', 'activity']) {
            const form = made(kind, { newSubjectName: '' });
            expect(entryPayload(form)).not.toHaveProperty('newSubject');
            expect(entryErrors(form)).not.toHaveProperty('newSubject');
        }
    });

    test('a normal pick sends no newSubject, and the title name follows the typed name', () => {
        expect(entryPayload({ ...emptyEntryForm('class', TODAY), title: 'A', subject: 's1', newSubjectName: 'x' })).not.toHaveProperty('newSubject');
        expect(subjectNameOf(made('class'), [])).toBe('Data Mining');
        expect(subjectNameOf({ subject: 's1' }, [{ _id: 's1', name: 'Web' }])).toBe('Web');
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
    test('entryStarted notices any change, the subject pick included', () => {
        const start = emptyEntryForm('class', TODAY);
        expect(entryStarted(start, start)).toBe(false);
        expect(entryStarted({ ...start, subject: 's1' }, start)).toBe(true);
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
