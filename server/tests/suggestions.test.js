import { describe, test, expect } from 'vitest';
import {
    buildWeek, computeWorkload, examsToTasks, examPressure,
} from '../../client/src/utils/workload.js';
import { suggestMoves, isStrained } from '../../client/src/utils/suggestions.js';

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

describe('move suggestions', () => {
    test('a week that fits gets none', () => {
        expect(run({ tasks: [task('a', { hours: 2, dueDate: iso(5) })], overview: overview() })).toEqual([]);
    });

    test('an overloaded stretch suggests moving one deadline later, and shows the gain', () => {
        const tasks = [task('a', { hours: 8, dueDate: iso(1) }), task('b', { hours: 8, dueDate: iso(1) })];
        const out = run({ tasks, overview: overview() });
        expect(out.length).toBeGreaterThan(0);
        expect(out[0].toDate > out[0].fromDate).toBe(true);
        expect(out[0].relief).toBeGreaterThanOrEqual(0.5);
        expect(out[0].why).toMatch(/more than you can fit/);
    });

    test('it prefers to move the less important task', () => {
        const tasks = [
            task('vital', { hours: 8, dueDate: iso(1), importance: 4 }),
            task('minor', { hours: 8, dueDate: iso(1), importance: 1 }),
        ];
        expect(run({ tasks, overview: overview() })[0].taskId).toBe('minor');
    });

    test('top-importance tasks are left alone unless the student is strained', () => {
        const tasks = [task('big', { hours: 14, dueDate: iso(1), importance: 5 })];
        expect(run({ tasks, overview: overview() })).toEqual([]);
        expect(run({ tasks, overview: overview(), strained: true }).length).toBeGreaterThan(0);
    });

    test('a strained student gets help sooner and the wording changes', () => {
        // A small overload: under the normal threshold, over the strained one.
        const tasks = [task('a', { hours: 6, dueDate: iso(0) })];
        const calm = run({ tasks, overview: overview({ 0: 5 }) });
        const strained = run({ tasks, overview: overview({ 0: 5 }), strained: true });
        expect(strained.length).toBeGreaterThanOrEqual(calm.length);
        if (strained.length) expect(strained[0].why).toMatch(/carrying a lot/);
    });

    test('never suggests more than two moves, or three when strained', () => {
        const tasks = ['a', 'b', 'c', 'd', 'e'].map((id) => task(id, { hours: 9, dueDate: iso(1), importance: 2 }));
        expect(run({ tasks, overview: overview() }).length).toBeLessThanOrEqual(2);
        expect(run({ tasks, overview: overview(), strained: true }).length).toBeLessThanOrEqual(3);
    });

    test('never lands a task on a day off in the visible week', () => {
        const tasks = [task('a', { hours: 9, dueDate: iso(1), importance: 1 }), task('b', { hours: 9, dueDate: iso(1), importance: 1 })];
        const out = run({ tasks, overview: overview({}, { 2: 'Holiday', 3: 'Holiday' }) });
        out.forEach((s) => expect([iso(2), iso(3)]).not.toContain(s.toDate));
    });

    test('each task is only suggested once', () => {
        const tasks = [task('a', { hours: 12, dueDate: iso(1), importance: 1 }), task('b', { hours: 12, dueDate: iso(1), importance: 1 })];
        const ids = run({ tasks, overview: overview(), strained: true }).map((s) => s.taskId);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test('exam preparation is planned around but never moved', () => {
        const fixed = examsToTasks([{ title: 'Finals', date: iso(2), prepHours: 12 }]);
        const tasks = [task('a', { hours: 6, dueDate: iso(2), importance: 2 })];
        const out = run({ tasks, fixedTasks: fixed, overview: overview(), strained: true });
        out.forEach((s) => expect(s.title).not.toMatch(/Prepare for/));
        expect(out.length).toBeGreaterThan(0);
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
