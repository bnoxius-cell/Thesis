import { describe, test, expect } from 'vitest';
import { noticePatterns } from '../../client/src/utils/patterns.js';
import { buildWeek, computeWorkload } from '../../client/src/utils/workload.js';

// Wednesday 30 Sep 2026, 12:00 local time.
const NOW = new Date(2026, 8, 30, 12, 0);
const iso = (offset) => {
    const d = new Date(2026, 8, 30 + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// Due dates are stored as midnight UTC of the picked day.
const due = (offset) => new Date(`${iso(offset)}T00:00:00.000Z`);
const at = (offset, hour = 12, minute = 0) => new Date(2026, 8, 30 + offset, hour, minute);

const open = (dueOffset) => ({ dueDate: due(dueOffset), hours: 2, isCompleted: false });
const done = (dueOffset, completedAt, hours = 3) => ({ dueDate: due(dueOffset), hours, isCompleted: true, completedAt });
// A task finished at this hour; its due date is far enough back to stay out of the other rules.
const finishedAt = (offset, hour, minute = 0) => done(-20, at(offset, hour, minute));
const keys = (input) => noticePatterns({ now: NOW, ...input }).map((p) => p.key);

describe('slipping', () => {
    test('fires at 3 tasks past their date in the last 14 days, not at 2', () => {
        const two = [open(-1), done(-5, at(-3))];
        expect(keys({ tasks: two })).toEqual([]);
        const [found] = noticePatterns({ now: NOW, tasks: [...two, open(-14)] });
        expect(found).toEqual({
            key: 'slipping',
            title: 'Deadlines have been slipping',
            text: '3 tasks went past their date in the last 2 weeks. Starting the bigger ones a day earlier helps.',
        });
    });

    test('done on the due day is on time; due today, in the future or over 14 days ago do not count', () => {
        const tasks = [done(-2, at(-2)), done(-3, at(-4)), open(0), open(-15), open(3), open(-1)];
        expect(keys({ tasks })).toEqual([]);
    });

    test('exam prep tasks are ignored', () => {
        const prep = { ...open(-1), isExam: true };
        expect(keys({ tasks: [prep, prep, prep] })).toEqual([]);
    });
});

describe('last-minute', () => {
    const onDay = (n) => Array.from({ length: n }, (_, i) => done(-3 - i, at(-3 - i)));
    const early = (n) => Array.from({ length: n }, (_, i) => done(-1 - i, at(-6 - i)));

    test('fires at 4 big tasks with 60% or more on the due day', () => {
        const tasks = [...onDay(3), ...early(2)];
        expect(keys({ tasks })).toEqual(['last-minute']);
        const [found] = noticePatterns({ now: NOW, tasks });
        expect(found.text).toBe('3 of your last 5 bigger tasks were finished on the day they were due. A day or two of room helps when something comes up.');
    });

    test('not with 3 tasks, below 60%, small tasks or tasks older than 28 days', () => {
        expect(keys({ tasks: onDay(3) })).toEqual([]);
        expect(keys({ tasks: [...onDay(2), ...early(3)] })).toEqual([]);
        expect(keys({ tasks: [...onDay(3), done(-4, at(-4), 1.5)] })).toEqual([]);
        expect(keys({ tasks: [...onDay(3), done(-29, at(-29))] })).toEqual([]);
    });

    test('tasks without completedAt are skipped', () => {
        expect(keys({ tasks: [...onDay(3), done(-9, null)] })).toEqual([]);
    });
});

describe('cram', () => {
    const exams = [{ title: 'Calculus', date: iso(3) }];
    const made = (n, hoursAgo = 10) => Array.from({ length: n }, () => ({ createdAt: new Date(NOW.getTime() - hoursAgo * 3600000) }));

    test('fires at 3 reviewers in 3 days with an exam in the next 3 days', () => {
        const [found] = noticePatterns({ now: NOW, exams, reviewers: made(3) });
        expect(found).toEqual({
            key: 'cram',
            title: 'Lots of reviewers before Calculus',
            text: 'You made 3 reviewers in 3 days. Next time, starting a week out spreads it.',
        });
    });

    test('not with 2 reviewers, an exam 4 days out, a past exam or old reviewers', () => {
        expect(keys({ exams, reviewers: made(2) })).toEqual([]);
        expect(keys({ exams: [{ title: 'Calculus', date: iso(4) }], reviewers: made(3) })).toEqual([]);
        expect(keys({ exams: [{ title: 'Calculus', date: iso(-1) }], reviewers: made(3) })).toEqual([]);
        expect(keys({ exams, reviewers: made(3, 80) })).toEqual([]);
    });
});

describe('late-night', () => {
    test('fires at 3 different nights, not 2', () => {
        const two = [finishedAt(-1, 1), finishedAt(-2, 2)];
        expect(keys({ tasks: two })).toEqual([]);
        const [found] = noticePatterns({ now: NOW, tasks: [...two, finishedAt(-3, 3, 59)] });
        expect(found).toEqual({
            key: 'late-night',
            title: 'Late nights are adding up',
            text: 'You worked past midnight on 3 nights in the last 2 weeks. An earlier stop helps your sleep plan.',
        });
    });

    test('counts distinct nights: work at 00:30, 01:00 and 02:00 is one night, and reviewers count too', () => {
        const sameNight = [finishedAt(-1, 1), finishedAt(-1, 2), finishedAt(-1, 0, 30)];
        expect(keys({ tasks: sameNight })).toEqual([]);
        const reviewers = [{ createdAt: at(-4, 0, 30) }, { createdAt: at(-5, 2) }];
        expect(keys({ tasks: sameNight, reviewers })).toEqual(['late-night']);
    });

    test('00:30 belongs to the evening before, so it is a different night from 23:00 that day', () => {
        // 00:30 on day -1 is the night of day -2. With one at 02:00 on day -2 (night of day -3) and one on day -4, that is 3.
        const tasks = [finishedAt(-1, 0, 30), finishedAt(-2, 2), finishedAt(-4, 1)];
        expect(keys({ tasks })).toEqual(['late-night']);
        // 00:30 on day -2 and 01:00 on day -2 share the night of day -3, so these are only 2.
        expect(keys({ tasks: [finishedAt(-2, 0, 30), finishedAt(-2, 1), finishedAt(-4, 1)] })).toEqual([]);
    });

    test('04:00, older than 14 days and missing completedAt do not count', () => {
        const tasks = [finishedAt(-1, 4), finishedAt(-2, 12), finishedAt(-15, 1), done(-9, null), { ...finishedAt(-3, 1), isCompleted: false }];
        expect(keys({ tasks })).toEqual([]);
    });
});

describe('noticePatterns', () => {
    test('empty inputs give []', () => {
        expect(noticePatterns({ now: NOW })).toEqual([]);
        expect(noticePatterns({ tasks: [], reviewers: [], exams: [], now: NOW })).toEqual([]);
    });

    test('returns at most 2, in priority order', () => {
        const nights = [finishedAt(-1, 1), finishedAt(-2, 1), finishedAt(-3, 1)];
        const reviewers = Array.from({ length: 3 }, () => ({ createdAt: NOW }));
        const exams = [{ title: 'Calculus', date: iso(1) }];
        const tasks = [open(-1), open(-2), open(-3), ...nights];
        expect(keys({ tasks, reviewers, exams })).toEqual(['slipping', 'cram']);
        expect(keys({ tasks: nights, reviewers, exams })).toEqual(['cram', 'late-night']);
    });
});

describe('computeWorkload never sees patterns', () => {
    const profile = { studyHoursPerDay: 4, wellbeingGoal: 'steady' };
    const workloadOf = (tasks) => {
        const days = buildWeek(tasks, profile, null, NOW);
        return computeWorkload({
            tasks, profile, days, pssScore: null, whoScore: null, hasSchedule: false,
            pssStatus: 'none', whoStatus: 'none', pssAgeDays: null, whoAgeDays: null, now: NOW,
        });
    };

    test('its output is the same before and after patterns are worked out', () => {
        const tasks = [{ _id: 'a', title: 'Essay', course: '', dueDate: iso(3), hours: 3, difficulty: 3, importance: 3 }];
        const before = JSON.stringify(workloadOf(tasks));
        noticePatterns({ tasks: [...tasks, open(-1), open(-2), open(-3)], reviewers: [{ createdAt: NOW }], exams: [], now: NOW });
        expect(JSON.stringify(workloadOf(tasks))).toBe(before);
    });
});
