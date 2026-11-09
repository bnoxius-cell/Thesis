import { describe, test, expect } from 'vitest';
import { buildWeekOverview, findUpcomingExams } from '../utils/weekOverview.js';

// 2026-10-05 is a Monday.
const START = '2026-10-05';

const schedule = (role, entries, extra = {}) => ({ _id: 'sch1', title: 'My 1st Sem', role, holidayOverrides: [], entries, ...extra });
const lesson = { _id: 'e1', title: 'Web Systems', kind: 'class', days: [1], startTime: '09:00', endTime: '10:00', notes: 'Bring the lab manual.' };
const exam = { _id: 'e2', title: 'Midterm', kind: 'exam', date: '2026-10-08', startTime: '13:00', endTime: '15:00', meetingUrl: 'https://meet.example.com/x' };

describe('buildWeekOverview', () => {
    test('each entry says which entry and timetable it came from, and its notes', () => {
        const [monday] = buildWeekOverview([schedule('owner', [lesson])], START, 1);
        expect(monday.entries[0]).toMatchObject({
            entryId: 'e1', scheduleId: 'sch1', scheduleTitle: 'My 1st Sem', notes: 'Bring the lab manual.',
        });
    });

    test.each([
        ['owner', true],
        ['editor', true],
        ['viewer', false],
        [undefined, false],
    ])('canEdit for a %s is %s', (role, expected) => {
        const [monday] = buildWeekOverview([schedule(role, [lesson])], START, 1);
        expect(monday.entries[0].canEdit).toBe(expected);
        expect(monday.entries[0]).not.toHaveProperty('role');
    });

    test('notes default to an empty string', () => {
        const { notes, ...bare } = lesson;
        const [monday] = buildWeekOverview([schedule('owner', [bare])], START, 1);
        expect(monday.entries[0].notes).toBe('');
    });

    test('the first schedule listed keeps a duplicated class', () => {
        const mine = schedule('owner', [lesson], { _id: 'mine' });
        const theirs = schedule('viewer', [{ ...lesson, _id: 'copy' }], { _id: 'theirs' });
        const [monday] = buildWeekOverview([mine, theirs], START, 1);
        expect(monday.entries).toHaveLength(1);
        expect(monday.entries[0]).toMatchObject({ entryId: 'e1', scheduleId: 'mine', canEdit: true });
    });
});

describe('findUpcomingExams', () => {
    test('exams carry the ids, rights, notes and meeting link', () => {
        const [found] = findUpcomingExams([schedule('viewer', [exam])], START, 30);
        expect(found).toMatchObject({
            entryId: 'e2', scheduleId: 'sch1', scheduleTitle: 'My 1st Sem', canEdit: false,
            notes: '', meetingUrl: 'https://meet.example.com/x',
        });
    });
});
