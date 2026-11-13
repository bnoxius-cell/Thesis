import { describe, test, expect } from 'vitest';
import { buildMonthRows } from '../../client/src/features/plan/monthDays.js';

const overview = (date, entries) => ({ days: [{ date, holiday: null, entries }] });
const entry = (id, kind, title) => ({ id, kind, title, startTime: '09:00', endTime: '10:00' });

describe('buildMonthRows', () => {
    test('events and activities show as labels, classes as dots, like Week', () => {
        const entries = [entry('a', 'class', 'Math'), entry('b', 'event', 'Fair'), entry('c', 'activity', 'Gym'), entry('d', 'exam', 'Quiz')];
        const overviews = new Map([['2026-11-09', overview('2026-11-10', entries)]]);
        const rows = buildMonthRows({
            month: new Date(2026, 10, 1), overviews, tasks: [], subjectsById: new Map(), now: new Date(2026, 10, 1),
        });
        const day = rows.flat().find((d) => d.key === '2026-11-10');
        expect(day.classCount).toBe(1);
        expect(day.labels.map((l) => l.text)).toEqual(['Exam: Quiz', 'Fair', 'Gym']);
    });
});
