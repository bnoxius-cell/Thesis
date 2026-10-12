import { describe, test, expect } from 'vitest';
import { sleepPlan, firstStartOf } from '../../client/src/utils/sleepPlan.js';

describe('sleepPlan', () => {
    test('early class: bedtime is earlier than the usual one', () => {
        const plan = sleepPlan({ first: { startTime: '07:30', kind: 'class' }, travelMinutes: 60, sleepHours: 7, usualSleepStart: '23:30' });
        // wake 07:30 - 30 - 60 = 06:00, bed 23:00 the night before
        expect(plan.wakeUp).toBe('6:00 AM');
        expect(plan.bedtime).toBe('11:00 PM');
        expect(plan.text).toContain('Your first class tomorrow is at 7:30 AM');
        expect(plan.text).toContain('about 30 minutes to get there');
        expect(plan.text).toContain('be in bed by 11:00 PM');
    });

    test('no class tomorrow gives nothing', () => {
        expect(sleepPlan({ first: null, sleepHours: 8, usualSleepStart: '23:00' })).toBeNull();
        expect(firstStartOf([{ kind: 'activity', startTime: '06:00' }])).toBeNull();
    });

    test('a late class does not ask for an earlier bedtime', () => {
        expect(sleepPlan({ first: { startTime: '13:00', kind: 'class' }, travelMinutes: 0, sleepHours: 8, usualSleepStart: '23:00' })).toBeNull();
    });

    test('no usual bedtime still shows the suggestion', () => {
        const plan = sleepPlan({ first: { startTime: '09:00', kind: 'class' }, travelMinutes: 0, sleepHours: 8, usualSleepStart: '' });
        expect(plan.bedtime).toBe('12:00 AM');
        expect(plan.wakeUp).toBe('8:00 AM');
    });

    test('zero travel leaves the travel sentence out', () => {
        const plan = sleepPlan({ first: { startTime: '07:30', kind: 'class' }, travelMinutes: 0, sleepHours: 8, usualSleepStart: '' });
        expect(plan.text).not.toContain('to get there');
        expect(plan.text).toContain('Your first class tomorrow is at 7:30 AM. To get 8 hours');
    });

    test('bedtime that wraps past midnight compares correctly with a usual 1 AM bedtime', () => {
        // first class 08:00, no travel: wake 07:00, 8h sleep means bed 11 PM, which is earlier than a 1 AM habit
        const early = sleepPlan({ first: { startTime: '08:00', kind: 'class' }, sleepHours: 8, usualSleepStart: '01:00' });
        expect(early.bedtime).toBe('11:00 PM');
        // first class 10:00: wake 09:00, bed 1 AM, which is not earlier than a 12:30 AM habit
        expect(sleepPlan({ first: { startTime: '10:00', kind: 'class' }, sleepHours: 8, usualSleepStart: '00:30' })).toBeNull();
    });

    test('an exam is called an exam, and the earliest class or exam wins', () => {
        const first = firstStartOf([
            { kind: 'class', startTime: '10:00' },
            { kind: 'exam', startTime: '08:00' },
        ]);
        expect(first).toEqual({ startTime: '08:00', kind: 'exam' });
        expect(sleepPlan({ first, sleepHours: 8, usualSleepStart: '' }).text).toContain('first exam tomorrow');
    });
});
