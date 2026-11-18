import { describe, test, expect } from 'vitest';
import {
    MAX_CLASS_TIMES, MAX_NEW_SUBJECTS, TERM_DAYS, addClassTime, addSubject, changeClassTime, changeSubject, classTimeCount,
    clashNotes, emptyTermForm, filledSubjects, keptEntries, nothingToApply, removeClassTime, removeSubject, scheduleSummary,
    setArchived, termErrors, termRequest, termStarted,
} from '../../client/src/features/study/term/newTermForm.js';
import { newTermText, restoreText } from '../../client/src/features/study/term/termText.js';

const active = [{ _id: 'a1' }, { _id: 'a2' }, { _id: 'a3' }];

// A form with the given subjects filled in: [name, [[days, start, end, room]]].
const filled = (subjects, extra = {}) => {
    let form = { ...emptyTermForm(active), ...extra };
    form = { ...form, subjects: [] };
    for (const [name, times] of subjects) {
        form = addSubject(form);
        const subject = form.subjects.at(-1);
        form = changeSubject(form, subject.key, { name });
        subject.classTimes.slice(1).forEach((time) => { form = removeClassTime(form, subject.key, time.key); });
        times.forEach(([days, startTime, endTime, location = ''], index) => {
            if (index > 0) form = addClassTime(form, subject.key);
            const row = form.subjects.find((s) => s.key === subject.key).classTimes[index];
            form = changeClassTime(form, subject.key, row.key, { days, startTime, endTime, location });
        });
    }
    return form;
};

describe('emptyTermForm', () => {
    test('ticks every active subject and starts with one empty subject row', () => {
        const form = emptyTermForm(active);
        expect(form.archiveIds).toEqual(['a1', 'a2', 'a3']);
        expect(form.subjects).toHaveLength(1);
        expect(form.subjects[0].classTimes).toHaveLength(1);
    });

    test('an untouched form has nothing to apply once nothing is ticked, and is not "started"', () => {
        const start = emptyTermForm(active);
        expect(termStarted(start, start)).toBe(false);
        expect(nothingToApply(setArchived(start, []))).toBe(true);
        expect(nothingToApply(start)).toBe(false);
    });
});

describe('days', () => {
    test('the wizard offers Monday to Saturday as Date#getDay numbers', () => {
        expect(TERM_DAYS.map((d) => d.value)).toEqual([1, 2, 3, 4, 5, 6]);
        expect(TERM_DAYS.map((d) => d.label)).toEqual(['M', 'T', 'W', 'Th', 'F', 'S']);
    });
});

describe('changes', () => {
    test('typing, ticking or adding a row makes the form "started"', () => {
        const start = emptyTermForm(active);
        const key = start.subjects[0].key;
        expect(termStarted(changeSubject(start, key, { name: 'Cloud' }), start)).toBe(true);
        expect(termStarted(setArchived(start, ['a1']), start)).toBe(true);
        expect(termStarted(addSubject(start), start)).toBe(true);
    });

    test('subjects and class times stop at the server limits', () => {
        let form = emptyTermForm([]);
        for (let i = 0; i < MAX_NEW_SUBJECTS + 3; i += 1) form = addSubject(form);
        expect(form.subjects).toHaveLength(MAX_NEW_SUBJECTS);
        const key = form.subjects[0].key;
        for (let i = 0; i < MAX_CLASS_TIMES + 3; i += 1) form = addClassTime(form, key);
        expect(form.subjects[0].classTimes).toHaveLength(MAX_CLASS_TIMES);
    });

    test('removing a subject leaves the others', () => {
        const form = addSubject(emptyTermForm([]));
        expect(removeSubject(form, form.subjects[0].key).subjects).toHaveLength(1);
    });
});

describe('filledSubjects', () => {
    test('an untouched row is ignored, a row with only a name counts, and so does a time with only a room', () => {
        let form = addSubject(emptyTermForm([]));
        expect(filledSubjects(form)).toHaveLength(0);
        form = changeSubject(form, form.subjects[1].key, { name: 'Ethics' });
        expect(filledSubjects(form).map((s) => s.name)).toEqual(['Ethics']);
        const first = form.subjects[0];
        form = changeClassTime(form, first.key, first.classTimes[0].key, { location: 'Rm 1' });
        expect(filledSubjects(form)).toHaveLength(2);
    });

    test('an untouched class time row of a named subject is dropped, so a subject can have none', () => {
        const form = filled([['Ethics', []]]);
        expect(classTimeCount(form)).toBe(0);
        expect(termRequest(form).subjects).toEqual([{ name: 'Ethics', code: '', classTimes: [] }]);
    });
});

describe('termErrors', () => {
    test('a subject needs a name, and a class time needs a day and an end after its start', () => {
        const form = filled([['', [[[1], '08:00', '09:30']]], ['Ethics', [[[], '08:00', '09:30', 'Rm 1'], [[2], '10:00', '09:00']]]]);
        const found = termErrors(form);
        const [nameless, ethics] = form.subjects;
        expect(found[nameless.key].name).toBe('Give the subject a name.');
        expect(found[ethics.key].name).toBeUndefined();
        expect(found[ethics.key].times[ethics.classTimes[0].key]).toBe('Pick at least one day.');
        expect(found[ethics.key].times[ethics.classTimes[1].key]).toBe('The end time must be after the start time.');
    });

    test('the same subject twice is refused, ignoring case and spacing', () => {
        const form = filled([['Web  Systems', [[[1], '08:00', '09:00']]], ['web systems', [[[2], '08:00', '09:00']]]]);
        expect(termErrors(form)[form.subjects[1].key].name).toBe('You listed this subject already.');
    });

    test('a complete form has no errors', () => {
        expect(termErrors(filled([['Cloud Computing', [[[1, 3], '08:00', '09:30']]]]))).toEqual({});
    });
});

describe('termRequest', () => {
    test('builds the body of POST /api/subjects/new-term', () => {
        const form = filled([
            ['  Cloud   Computing ', [[[3, 1], '08:00', '09:30', ' Rm 305 '], [[5], '13:00', '16:00']]],
        ], { term: ' 2nd Sem ', firstDay: '2027-01-12' });
        expect(termRequest(form)).toEqual({
            archive: ['a1', 'a2', 'a3'],
            term: '2nd Sem',
            firstDay: '2027-01-12',
            subjects: [{
                name: 'Cloud Computing',
                code: '',
                classTimes: [
                    { days: [1, 3], startTime: '08:00', endTime: '09:30', location: 'Rm 305' },
                    { days: [5], startTime: '13:00', endTime: '16:00', location: '' },
                ],
            }],
        });
    });

    test('leaves the term name and first day out when they are empty', () => {
        const request = termRequest(setArchived(emptyTermForm(active), ['a2']));
        expect(request).toEqual({ archive: ['a2'], term: undefined, firstDay: undefined, subjects: [] });
        expect(JSON.parse(JSON.stringify(request))).toEqual({ archive: ['a2'], subjects: [] });
    });

    test('sends the row keys and the "fresh" flag nowhere', () => {
        const form = filled([['Ethics', [[[1], '08:00', '09:00']]]]);
        expect(JSON.stringify(termRequest(form))).not.toMatch(/key|fresh/);
    });
});

describe('clashNotes', () => {
    const kept = [
        { _id: 'k1', title: 'Databases', kind: 'class', subject: 's-db', days: [1], date: '', startDate: '', endDate: '', startTime: '08:00', endTime: '09:00' },
        { _id: 'k2', title: 'Midterm', kind: 'exam', subject: 's-db', days: [], date: '2026-12-14', startDate: '', endDate: '', startTime: '08:00', endTime: '10:00' },
    ];

    test('warns about a class time that overlaps one typed above it', () => {
        const form = filled([
            ['Cloud Computing', [[[1, 3], '08:00', '09:30']]],
            ['Mobile Development', [[[1], '08:30', '10:00']]],
        ]);
        const notes = clashNotes(form, []);
        const [cloud, mobile] = form.subjects;
        expect(notes[cloud.classTimes[0].key]).toBeUndefined();
        expect(notes[mobile.classTimes[0].key]).toBe('Mon 8:30 am to 10:00 am overlaps Cloud Computing. You can still add it.');
    });

    test('warns about a class already in the timetable, but not one that leaves with the archive', () => {
        const form = filled([['Cloud Computing', [[[1], '08:30', '09:30']]]]);
        const key = form.subjects[0].classTimes[0].key;
        expect(clashNotes(form, keptEntries([kept[0]], []))[key]).toMatch(/overlaps Databases/);
        expect(clashNotes(form, keptEntries([kept[0]], ['s-db']))[key]).toBeUndefined();
    });

    test('an exam stays in the timetable when its subject is archived, so it can still clash', () => {
        expect(keptEntries(kept, ['s-db']).map((entry) => entry._id)).toEqual(['k2']);
        const form = filled([['Cloud Computing', [[[1], '08:30', '09:30']]]]);
        expect(clashNotes(form, keptEntries(kept, ['s-db']))[form.subjects[0].classTimes[0].key]).toMatch(/overlaps Midterm/);
    });

    test('an exam before the first day does not clash, a class on the first week does', () => {
        const form = filled([['Cloud Computing', [[[1], '08:00', '09:30']]]], { firstDay: '2027-01-12' });
        const key = form.subjects[0].classTimes[0].key;
        const examKept = [kept[1], { ...kept[0], endDate: '2026-12-20' }];
        expect(clashNotes(form, examKept)[key]).toBeUndefined();
        expect(clashNotes(form, [kept[0]])[key]).toMatch(/overlaps Databases/);
    });

    test('says a repeated class time is added once, and skips rows that are not complete yet', () => {
        const form = filled([['Cloud Computing', [[[1], '08:00', '09:30'], [[1], '08:00', '09:30'], [[], '08:00', '09:30', 'x']]]]);
        const [first, again, incomplete] = form.subjects[0].classTimes.map((t) => t.key);
        const notes = clashNotes(form, []);
        expect(notes[first]).toBeUndefined();
        expect(notes[again]).toBe('This class time is already there, so we add it once.');
        expect(notes[incomplete]).toBeUndefined();
    });
});

describe('scheduleSummary', () => {
    test('lists each class time as its days in week order and its start', () => {
        const form = filled([['Cloud Computing', [[[3, 1], '08:00', '09:30'], [[5], '13:00', '16:00']]]]);
        expect(scheduleSummary(form.subjects[0])).toBe('Mon, Wed 8:00 am · Fri 1:00 pm');
    });
});

describe('newTermText', () => {
    const result = { archived: 6, subjects: new Array(7).fill({}), classTimesAdded: 11, skipped: 2 };

    test('says what was archived, added and skipped', () => {
        expect(newTermText(result, 'My 1st Sem')).toEqual({
            headline: '6 subjects archived. 7 subjects and 11 class times added to My 1st Sem.',
            skipped: '2 class times were already there, so we skipped them.',
        });
    });

    test('says only what happened, singular and plural', () => {
        expect(newTermText({ archived: 1, subjects: [], classTimesAdded: 0, skipped: 1 }, 'X')).toEqual({
            headline: '1 subject archived.',
            skipped: '1 class time was already there, so we skipped it.',
        });
        expect(newTermText({ archived: 0, subjects: [], classTimesAdded: 0, skipped: 0 }, 'X').headline).toBe('Nothing needed changing.');
    });
});

describe('restoreText', () => {
    test('says how many class times came back, or that the timetable was full', () => {
        expect(restoreText('Ethics', { classTimesAdded: 2, timetableFull: false })).toBe('Ethics is back, with 2 class times in your timetable.');
        expect(restoreText('Ethics', { classTimesAdded: 0, timetableFull: false })).toBe('Ethics is back.');
        expect(restoreText('Ethics', { classTimesAdded: 0, timetableFull: true })).toMatch(/timetable is full/);
    });
});
