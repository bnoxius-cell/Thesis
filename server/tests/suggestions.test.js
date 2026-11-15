import { describe, test, expect } from 'vitest';
import {
    buildWeek, computeWorkload, examsToTasks, examPressure,
} from '../../client/src/utils/workload.js';
import { suggestMoves, isStrained, ideaTitle } from '../../client/src/utils/suggestions.js';

const NOW = new Date(2026, 8, 30, 10, 0); // Wed 30 Sep 2026
const iso = (offset) => {
    const d = new Date(2026, 8, 30 + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const profile = { studyHoursPerDay: 4, wellbeingGoal: 'steady' };
const task = (id, overrides = {}) => ({
    _id: id, title: id, course: 'CS', dueDate: iso(2), hours: 3, difficulty: 3, importance: 3, ...overrides,
});
const overview = (busyByOffset = {}, holidays = {}) => ({
    scheduleCount: 1,
    entryCount: 1,
    days: Array.from({ length: 7 }, (_, i) => ({
        date: iso(i), entries: [], holiday: holidays[i] || null,
        classHours: busyByOffset[i] || 0, activityHours: 0, busyHours: busyByOffset[i] || 0,
    })),
});
const run = (opts) => suggestMoves({ profile, now: NOW, ...opts });

// Earlier days only help when the week is jammed from today until the deadline, so the fixture is crowded:
// hardly any room on days 1 to 3, and a small task due on day 6 whose hours land on the packed days.
const crowded = (smallOverrides = {}) => ({
    overview: overview({ 1: 12, 2: 15, 3: 6 }),
    tasks: [
        task('t0', { hours: 11, dueDate: iso(3) }), task('t1', { hours: 11, dueDate: iso(2) }),
        task('t2', { hours: 12, dueDate: iso(3) }), task('t3', { hours: 13, dueDate: iso(6) }),
        task('t4', { hours: 11, dueDate: iso(6) }), task('small', { hours: 2, dueDate: iso(6), ...smallOverrides }),
    ],
});

describe('earlier-day suggestions', () => {
    test('a week that fits gets none', () => {
        expect(run({ tasks: [task('a', { hours: 2, dueDate: iso(5) })], overview: overview() })).toEqual([]);
    });

    test('an overloaded week suggests starting a task earlier, and shows the gain', () => {
        const out = run({ ...crowded(), strained: true });
        expect(out.length).toBeGreaterThan(0);
        expect(out[0]).toMatchObject({ taskId: 'small', doOn: iso(5), dueDate: iso(6), daysEarlier: 1 });
        expect(out[0].relief).toBeGreaterThanOrEqual(0.5);
        expect(out[0].why).toMatch(/Doing this one earlier/);
    });

    test('every idea starts between today and the day before the deadline, and never moves it', () => {
        const out = run({ ...crowded(), strained: true });
        expect(out.length).toBeGreaterThan(0);
        out.forEach((s) => {
            expect(s.doOn >= iso(0) && s.doOn < s.dueDate).toBe(true);
            expect(s).not.toHaveProperty('toDate');
            expect(s).not.toHaveProperty('fromDate');
        });
    });

    test('tasks due today or overdue get no idea', () => {
        const tasks = [task('a', { hours: 9, dueDate: iso(0) }), task('b', { hours: 9, dueDate: iso(-2) })];
        expect(run({ tasks, overview: overview(), strained: true })).toEqual([]);
    });

    test('when every earlier day is already full there is no idea', () => {
        const tasks = [task('a', { hours: 8, dueDate: iso(1) }), task('b', { hours: 8, dueDate: iso(1) })];
        expect(run({ tasks, overview: overview({ 0: 10 }), strained: true })).toEqual([]);
    });

    test('top-importance tasks are left alone unless the student is strained', () => {
        const input = crowded({ importance: 5 });
        expect(run(input)).toEqual([]);
        expect(run({ ...input, strained: true }).map((s) => s.taskId)).toContain('small');
    });

    test('never suggests a day off', () => {
        const input = { ...crowded(), overview: overview({ 1: 12, 2: 15, 3: 6 }, { 5: 'Holiday' }) };
        const out = run({ ...input, strained: true });
        out.forEach((s) => expect(s.doOn).not.toBe(iso(5)));
    });

    test('never suggests more than two ideas, or three when strained, and each task once', () => {
        expect(run(crowded()).length).toBeLessThanOrEqual(2);
        const ids = run({ ...crowded(), strained: true }).map((s) => s.taskId);
        expect(ids.length).toBeLessThanOrEqual(3);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test('exam preparation is planned around but never suggested', () => {
        const fixed = examsToTasks([{ title: 'Finals', date: iso(2), prepHours: 12 }]);
        const out = run({ ...crowded(), fixedTasks: fixed, strained: true });
        out.forEach((s) => expect(s.title).not.toMatch(/Prepare for/));
    });

    test('ideaTitle names the day to do it and the deadline', () => {
        const idea = { title: 'ye', doOn: iso(0), dueDate: iso(2) };
        expect(ideaTitle(idea, NOW)).toBe('Do "ye" today instead of Friday');
        expect(ideaTitle({ ...idea, doOn: iso(1) }, NOW)).toBe('Do "ye" tomorrow instead of Friday');
        expect(ideaTitle({ ...idea, dueDate: iso(1) }, NOW)).toBe('Do "ye" today instead of tomorrow');
        expect(ideaTitle({ ...idea, doOn: iso(2), dueDate: iso(8) }, NOW)).toBe('Do "ye" on Friday instead of Oct 8');
    });

    test('the words never talk about moving a deadline', () => {
        [false, true].forEach((strained) => {
            run({ ...crowded(), strained }).forEach((s) => {
                expect(s.why).not.toMatch(/Moving this deadline|Move/);
                expect(ideaTitle(s, NOW)).not.toMatch(/Move/);
            });
        });
        expect(run({ ...crowded(), strained: true })[0].why).toMatch(/The deadline stays the same/);
    });

    test('isStrained looks at the band and at fresh check-in scores', () => {
        expect(isStrained({ band: 'Light Workload', pssScore: null, whoScore: null })).toBe(false);
        expect(isStrained({ band: 'Heavy Workload' })).toBe(true);
        expect(isStrained({ band: 'Light Workload', pssScore: 30, whoScore: null })).toBe(true);
        expect(isStrained({ band: 'Light Workload', pssScore: null, whoScore: 40 })).toBe(true);
        expect(isStrained({ band: 'Light Workload', pssScore: 10, whoScore: 70 })).toBe(false);
    });
});

describe('exams in the workload', () => {
    const examDay = (offset, extra = {}) => ({ title: 'Calculus', date: iso(offset), startTime: '09:00', endTime: '11:00', prepHours: 6, ...extra });
    const score = (exams, tasks = []) => {
        const planned = [...tasks, ...examsToTasks(exams)];
        const days = buildWeek(planned, profile, overview({}), NOW);
        return computeWorkload({ tasks: planned, profile, days, hasSchedule: true, now: NOW, exams });
    };

    test('exams with study hours become tasks due on the exam date', () => {
        const [t] = examsToTasks([examDay(3)]);
        expect(t).toMatchObject({ title: 'Prepare for Calculus', dueDate: iso(3), hours: 6, importance: 5, isExam: true });
        expect(examsToTasks([examDay(3, { prepHours: 0 })])).toEqual([]);
    });

    test('a near exam raises the score and the pressure grows as it gets closer', () => {
        const none = score([]);
        const week = score([examDay(6)]);
        const close = score([examDay(1)]);
        expect(week.workloadScore).toBeGreaterThan(none.workloadScore);
        expect(close.adjustments.exam).toBe(15);
        expect(week.adjustments.exam).toBe(8);
    });

    test('two exams in a week count as full exam pressure', () => {
        expect(examPressure([examDay(5), examDay(6, { title: 'Physics' })], NOW).points).toBe(15);
        expect(examPressure([examDay(20)], NOW).points).toBe(0);
    });

    test('the guidance names the exam', () => {
        expect(score([examDay(1)]).tips.some((t) => t.title === 'Exam tomorrow: Calculus')).toBe(true);
        expect(score([examDay(5)]).tips.some((t) => t.title.startsWith('Exam in 5 days'))).toBe(true);
        expect(score([examDay(0)]).tips.some((t) => t.title === 'Exam today: Calculus')).toBe(true);
    });

    test('an exam alone is enough to leave the getting-started state', () => {
        expect(score([examDay(4)]).isNewUser).toBe(false);
    });
});
