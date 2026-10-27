import { describe, test, expect } from 'vitest';
import {
    buildWeek, computeWorkload, getTaskMetrics, surveyStatus, clampHours, MAX_TASK_HOURS, PSS_VALID_DAYS, WHO_VALID_DAYS,
} from '../../client/src/utils/workload.js';

// Wednesday 30 Sep 2026, 10:30 local time.
const NOW = new Date(2026, 8, 30, 10, 30);
const iso = (offset) => {
    const d = new Date(2026, 8, 30 + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const task = (hours) => ({ _id: 't1', title: 'Essay', course: '', dueDate: iso(3), hours, difficulty: 3, importance: 3 });

const score = (hours) => {
    const tasks = [task(hours)];
    const profile = { studyHoursPerDay: 4, wellbeingGoal: 'steady' };
    const days = buildWeek(tasks, profile, null, NOW);
    const p = surveyStatus(null, null, PSS_VALID_DAYS, NOW);
    const w = surveyStatus(null, null, WHO_VALID_DAYS, NOW);
    const result = computeWorkload({
        tasks, profile, days, pssScore: p.score, whoScore: w.score, hasSchedule: false,
        pssStatus: p.status, whoStatus: w.status, pssAgeDays: p.ageDays, whoAgeDays: w.ageDays, now: NOW,
    });
    return { days, result, metrics: getTaskMetrics(tasks[0], NOW) };
};

describe('task hours are clamped when the workload is worked out', () => {
    test('clampHours keeps 0 to 24 and survives junk', () => {
        expect(MAX_TASK_HOURS).toBe(24);
        expect(clampHours(3)).toBe(3);
        expect(clampHours(24)).toBe(24);
        expect(clampHours(999)).toBe(24);
        expect(clampHours(1e9)).toBe(24);
        expect(clampHours(-5)).toBe(0);
        expect(clampHours('abc')).toBe(0);
        expect(clampHours(undefined)).toBe(0);
    });

    test('a stored 1e9 counts as 24: same score, same chart, finite numbers', () => {
        const huge = score(1e9);
        const cap = score(24);
        expect(huge.result.workloadScore).toBe(cap.result.workloadScore);
        expect(huge.metrics.workload).toBe(cap.metrics.workload);
        expect(huge.days.map((d) => d.load)).toEqual(cap.days.map((d) => d.load));
        expect(Number.isFinite(huge.result.workloadScore)).toBe(true);
        expect(huge.days.every((d) => Number.isFinite(d.load))).toBe(true);
    });
});
