import { describe, test, expect } from 'vitest';
import { toWeekReading, WORKLOAD_NOTE } from '../../client/src/utils/weekReading.js';
import { BAND_LABEL } from '../../client/src/utils/workload.js';

// Wednesday 30 Sep 2026, 10:30 local time.
const NOW = new Date(2026, 8, 30, 10, 30);
const isoDay = (offset) => {
    const d = new Date(2026, 8, 30 + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const PARTS = [
    { key: 'time', label: 'Deadlines', value: 80, level: 'high' },
    { key: 'schedule', label: 'Classes and activities', value: 55, level: 'moderate' },
    { key: 'stress', label: 'Stress check-in', value: 30, level: 'low' },
    { key: 'wellbeing', label: 'Well-being check-in', value: 20, level: 'low' },
];

const insightsFor = (band, extra = {}) => ({ band, workloadScore: 42, parts: PARTS, ...extra });

describe('toWeekReading', () => {
    test.each([
        ['Light Workload', 'light', 'Light week'],
        ['Moderate Workload', 'steady', 'Steady week'],
        ['Heavy Workload', 'full', 'Full week'],
        ['Critical Overload', 'over', 'Very full week'],
    ])('%s maps to %s with the label %s', (name, band, label) => {
        const reading = toWeekReading({ insights: insightsFor(name), plannedTasks: [], now: NOW });
        expect(reading.band).toBe(band);
        expect(reading.label).toBe(label);
        expect(reading.headline.length).toBeGreaterThan(0);
    });

    test('the band label comes from the one shared constant', () => {
        expect(BAND_LABEL['Critical Overload']).toBe('Very full week');
        expect(Object.values(BAND_LABEL).join(' ')).not.toMatch(/too much/i);
    });

    test('reasons are capped at 3 even with more parts', () => {
        const parts = [...PARTS, { key: 'time', label: 'Deadlines', value: 10, level: 'low' }];
        const reading = toWeekReading({ insights: insightsFor('Heavy Workload', { parts }), plannedTasks: [], now: NOW });
        expect(reading.reasons.length).toBe(3);
        expect(reading.reasons.every((r) => typeof r === 'string' && r.length > 0)).toBe(true);
    });

    test('the note is always present, whatever the band', () => {
        for (const name of ['Light Workload', 'Moderate Workload', 'Heavy Workload', 'Critical Overload']) {
            expect(toWeekReading({ insights: insightsFor(name), plannedTasks: [], now: NOW }).note).toBe(WORKLOAD_NOTE);
        }
        expect(WORKLOAD_NOTE).toBe('This is a workload estimate, not a measure of your stress.');
    });

    test('the deadline reason says how many things are due this week', () => {
        const plannedTasks = [{ dueDate: isoDay(1) }, { dueDate: isoDay(3) }, { dueDate: isoDay(20) }];
        const reading = toWeekReading({ insights: insightsFor('Heavy Workload'), plannedTasks, now: NOW });
        expect(reading.reasons.some((r) => r.includes('2 things due this week'))).toBe(true);
    });

    test('one action: overdue tasks lead to the task list, otherwise to Wellbeing', () => {
        const calm = toWeekReading({ insights: insightsFor('Light Workload'), plannedTasks: [{ dueDate: isoDay(2) }], now: NOW });
        expect(calm.actions).toEqual([{ label: 'See details', to: '/wellbeing' }]);

        const late = toWeekReading({ insights: insightsFor('Heavy Workload'), plannedTasks: [{ dueDate: isoDay(-1) }], now: NOW });
        expect(late.actions).toEqual([{ label: 'See overdue tasks', to: '/schedule?tab=tasks' }]);
    });

    test('score is carried for Wellbeing and the shape is exactly the contract', () => {
        const reading = toWeekReading({ insights: insightsFor('Moderate Workload'), plannedTasks: [], now: NOW });
        expect(reading.score).toBe(42);
        expect(Object.keys(reading).sort()).toEqual(['actions', 'band', 'headline', 'label', 'note', 'reasons', 'score']);
    });
});
