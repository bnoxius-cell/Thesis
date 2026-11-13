import { describe, test, expect } from 'vitest';
import { cheerLine, CHEER_LINES } from '../../client/src/utils/cheerLine.js';
import { daySummary } from '../../client/src/features/details/detailText.js';
import { buildDay, findOverviewDay } from '../../client/src/features/plan/planDays.js';

const profile = { studyHoursPerDay: 3, sleepHours: 8, travelMinutesPerDay: 0 };
const entry = (kind, startTime = '09:00', endTime = '10:00', title = kind) => ({ kind, startTime, endTime, title });
const day = (over = {}) => ({ holiday: null, entries: [], tasks: [], load: 'light', ...over });
const items = (n) => Array.from({ length: n }, (_, i) => ({ task: { _id: `t${i}` } }));

describe('cheerLine', () => {
    test('a day off wins over everything else', () => {
        expect(cheerLine(day({ holiday: 'Bonifacio Day', entries: [entry('class')], load: 'heavy' }))).toBe(CHEER_LINES.off);
    });

    test('an empty day', () => {
        expect(cheerLine(day())).toBe(CHEER_LINES.empty);
    });

    test('light, steady, heavy and full by how much is on the day', () => {
        expect(cheerLine(day({ entries: [entry('class')], tasks: items(1) }))).toBe(CHEER_LINES.light);
        expect(cheerLine(day({ entries: [entry('class')], tasks: items(2) }))).toBe(CHEER_LINES.steady);
        expect(cheerLine(day({ entries: [entry('class')], tasks: items(2), load: 'heavy' }))).toBe(CHEER_LINES.heavy);
        expect(cheerLine(day({ entries: [entry('class'), entry('class')], tasks: items(4), load: 'heavy' }))).toBe(CHEER_LINES.full);
    });

    test('there are six distinct lines', () => {
        expect(new Set(Object.values(CHEER_LINES)).size).toBe(6);
    });
});

describe('daySummary', () => {
    test('a busy day counts each kind, then the tasks', () => {
        const entries = [entry('class'), entry('class'), entry('class'), entry('exam')];
        expect(daySummary(day({ entries, tasks: items(2), load: 'heavy' }))).toBe('Busy day · 3 classes, 1 exam, 2 tasks due');
    });

    test('singular counts and a light day', () => {
        expect(daySummary(day({ entries: [entry('event')], tasks: items(1) }))).toBe('Light day · 1 event, 1 task due');
    });

    test('a day off keeps its tasks', () => {
        expect(daySummary(day({ holiday: 'Holiday', tasks: items(1) }))).toBe('Day off · 1 task due');
    });

    test('a free day says only that', () => {
        expect(daySummary(day())).toBe('Free day');
    });
});

describe('buildDay', () => {
    const task = (id, dueDate, extra = {}) => ({ _id: id, title: id, dueDate, isCompleted: false, hours: 1, ...extra });
    const build = (iso, tasks, overviewDay) => buildDay({ iso, overviewDay, tasks, subjects: [], profile, todayIso: '2025-10-29' });

    test('names the day and marks today', () => {
        const built = build('2025-10-29', []);
        expect(built).toMatchObject({ key: '2025-10-29', isToday: true, dayNumber: 29, holiday: null, load: 'light' });
        expect(built.label).toBe('Wednesday, Oct 29');
        expect(build('2025-10-30', []).isToday).toBe(false);
    });

    test('keeps only open tasks due that day', () => {
        const built = build('2025-10-30', [task('a', '2025-10-30T12:00:00Z'), task('b', '2025-10-31T12:00:00Z'), task('c', '2025-10-30T12:00:00Z', { isCompleted: true })]);
        expect(built.tasks.map((item) => item.task._id)).toEqual(['a']);
    });

    test('overdue tasks sit on today only', () => {
        const old = task('old', '2025-10-20T12:00:00Z');
        expect(build('2025-10-29', [old]).tasks).toMatchObject([{ overdue: true }]);
        expect(build('2025-10-28', [old]).tasks).toEqual([]);
    });

    test('entries come with a look and their length', () => {
        const built = build('2025-10-29', [], { date: '2025-10-29', holiday: 'Day off', busyHours: 1.5, entries: [entry('exam', '09:00', '10:30', 'Midterm')] });
        expect(built.holiday).toBe('Day off');
        expect(built.entries[0]).toMatchObject({ id: '09:00-10:30-Midterm', tone: 'neutral', hours: 1.5 });
    });
});

describe('findOverviewDay', () => {
    const weeks = [null, { days: [{ date: '2025-10-27' }] }, { days: [{ date: '2025-11-03', holiday: 'x' }] }];

    test('finds the day across several weeks, skipping empty ones', () => {
        expect(findOverviewDay(weeks, '2025-11-03')).toMatchObject({ holiday: 'x' });
    });

    test('is undefined when no week has it', () => {
        expect(findOverviewDay(weeks, '2025-12-01')).toBeUndefined();
        expect(findOverviewDay([], '2025-12-01')).toBeUndefined();
    });
});
