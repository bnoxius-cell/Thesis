import { describe, test, expect } from 'vitest';
import {
    addSubjectErrors, addSubjectPayload, addSubjectStarted, addTime, changeTime, clashNotesFor, emptyAddSubjectForm, hasErrors, removeTime,
} from '../../client/src/features/study/addSubjectForm.js';
import { MAX_CLASS_TIMES } from '../../client/src/features/study/term/newTermForm.js';
import { timeRangeText } from '../../client/src/features/plan/entryTime.js';

// A form with a name and the given class times: [days, start, end, room].
const filled = (times, name = 'Databases') => {
    let form = { ...emptyAddSubjectForm(), name, code: ' DBMS   101 ' };
    for (const [days, startTime, endTime, location = ''] of times) {
        form = addTime(form);
        form = changeTime(form, form.classTimes.at(-1).key, { days, startTime, endTime, location });
    }
    return form;
};

describe('the Add subject form', () => {
    test('starts with no class times, and adding or removing a row makes it "started"', () => {
        const start = emptyAddSubjectForm();
        expect(start.classTimes).toEqual([]);
        expect(addSubjectStarted(start, start)).toBe(false);
        const added = addTime(start);
        expect(added.classTimes).toHaveLength(1);
        expect(addSubjectStarted(start, added)).toBe(true);
        expect(addSubjectStarted(start, removeTime(added, added.classTimes[0].key))).toBe(false);
        expect(addSubjectStarted(start, { ...start, name: 'Math' })).toBe(true);
    });

    test('stops at six class times', () => {
        let form = emptyAddSubjectForm();
        for (let i = 0; i < MAX_CLASS_TIMES + 3; i += 1) form = addTime(form);
        expect(form.classTimes).toHaveLength(MAX_CLASS_TIMES);
    });

    test('a new row has default hours and no days, and changing one leaves the others', () => {
        let form = addTime(addTime(emptyAddSubjectForm()));
        const [first, second] = form.classTimes;
        expect(first).toMatchObject({ days: [], startTime: '08:00', endTime: '09:30', location: '' });
        form = changeTime(form, first.key, { days: [1, 3] });
        expect(form.classTimes[0].days).toEqual([1, 3]);
        expect(form.classTimes[1]).toBe(second);
    });
});

describe('addSubjectErrors', () => {
    test('a nameless subject is named as such, even with no class times', () => {
        expect(addSubjectErrors({ ...emptyAddSubjectForm(), name: ' ' }).name).toBe('Give the subject a name.');
        expect(hasErrors(addSubjectErrors(filled([], 'Math')))).toBe(false);
    });

    test('a class time needs an end after the start, and a row still untouched is ignored', () => {
        const form = filled([[[], '08:00', '09:30'], [[1], '10:00', '09:00'], [[2], '08:00', '09:00']]);
        const [untouched, backwards, fine] = form.classTimes;
        const { times } = addSubjectErrors(form);
        expect(times[backwards.key]).toBe('The end time must be after the start time.');
        expect(times[fine.key]).toBeUndefined();
        expect(times[untouched.key]).toBeUndefined();
        expect(hasErrors(addSubjectErrors(form))).toBe(true);
    });

    test('a row with a room but no days says to pick a day', () => {
        const form = filled([[[], '08:00', '09:30', 'Rm 1']]);
        expect(addSubjectErrors(form).times[form.classTimes[0].key]).toBe('Pick at least one day.');
    });
});

describe('addSubjectPayload', () => {
    test('is the subject and its filled class times, cleaned and in week order (Sunday last)', () => {
        const form = filled([[[0, 5, 1], '13:00', '16:00', '  Lab   2 '], [[], '08:00', '09:30']]);
        expect(addSubjectPayload(form)).toEqual({
            name: 'Databases',
            code: 'DBMS 101',
            term: '',
            classTimes: [{ days: [1, 5, 0], startTime: '13:00', endTime: '16:00', location: 'Lab 2' }],
        });
    });

    test('without class times the list is empty', () => {
        expect(addSubjectPayload(filled([])).classTimes).toEqual([]);
    });
});

describe('clashNotesFor', () => {
    const entries = [{ kind: 'class', title: 'Networking', days: [1], date: '', startDate: '', endDate: '', startTime: '08:00', endTime: '09:30' }];

    test('warns about a class time that overlaps the timetable, by row, and never about a free one', () => {
        const form = filled([[[1], '08:30', '10:00'], [[2], '08:30', '10:00']]);
        const notes = clashNotesFor(form, entries);
        expect(notes[form.classTimes[0].key]).toBe('Mon 8:30 am to 10:00 am overlaps Networking. You can still add it.');
        expect(notes[form.classTimes[1].key]).toBeUndefined();
    });

    test('says nothing while the timetable is still loading', () => {
        expect(clashNotesFor(filled([[[1], '08:00', '09:30']]), undefined)).toEqual({});
    });
});

describe('timeRangeText', () => {
    test('shares the am or pm when both ends have it', () => {
        expect(timeRangeText('08:00', '09:30')).toBe('8:00 to 9:30 am');
        expect(timeRangeText('13:00', '16:00')).toBe('1:00 to 4:00 pm');
        expect(timeRangeText('11:00', '13:00')).toBe('11:00 am to 1:00 pm');
    });
});
