import { describe, test, expect } from 'vitest';
import { bedtimeFor, bedtimeLabel, bedtimeSum, rhythmForm, rhythmOptions, sleepForm, sleepPayload } from '../../client/src/features/wellbeing/rhythm.js';
import { rhythmChips } from '../../client/src/features/wellbeing/rhythmChips.js';
import { sleepSummary } from '../../client/src/features/wellbeing/sleepSummary.js';
import { sleepExplainerPoints } from '../../client/src/features/wellbeing/sleepExplainerPoints.js';

describe('bedtimeFor', () => {
    test('wake time minus the sleep target', () => {
        expect(bedtimeFor('07:00', 8)).toBe('23:00');
        expect(bedtimeFor('06:45', 7.5)).toBe('23:15');
    });

    test('wraps past midnight in both directions', () => {
        expect(bedtimeFor('04:30', 8)).toBe('20:30');
        expect(bedtimeFor('23:30', 4)).toBe('19:30');
        expect(bedtimeFor('00:00', 8)).toBe('16:00');
    });
});

describe('bedtime labels', () => {
    test('shows the worked-out bedtime and the sum behind it', () => {
        const form = { usualWakeTime: '06:15', sleepHours: 8 };
        expect(bedtimeLabel(form)).toBe('10:15 pm');
        expect(bedtimeSum(form)).toBe('6:15 am wake time minus 8 hours');
        expect(bedtimeSum({ usualWakeTime: '06:15', sleepHours: 1 })).toBe('6:15 am wake time minus 1 hour');
    });

    test('are empty until a wake time is picked', () => {
        expect(bedtimeLabel({ usualWakeTime: '', sleepHours: 8 })).toBe('');
        expect(bedtimeSum({ usualWakeTime: '', sleepHours: 8 })).toBe('');
    });
});

describe('sleepPayload', () => {
    test('a picked wake time saves it with the worked-out bedtime and a regular schedule', () => {
        expect(sleepPayload({ usualWakeTime: '07:00', sleepHours: 8, travelMinutesPerDay: 40 })).toEqual({
            usualWakeTime: '07:00',
            sleepHours: 8,
            travelMinutesPerDay: 40,
            usualSleepStart: '23:00',
            hasRegularSleepSchedule: true,
        });
    });

    test('with no wake time yet only the target and travel go, so no schedule is made up', () => {
        expect(sleepPayload({ usualWakeTime: '', sleepHours: 9, travelMinutesPerDay: 0 })).toEqual({
            sleepHours: 9,
            travelMinutesPerDay: 0,
        });
    });
});

describe('forms', () => {
    test('the Tonight card starts with an empty wake time for a new account', () => {
        expect(sleepForm({})).toEqual({ usualWakeTime: '', sleepHours: 8, travelMinutesPerDay: 0 });
        expect(sleepForm({ usualWakeTime: '06:30', sleepHours: 7, travelMinutesPerDay: 60 }).usualWakeTime).toBe('06:30');
    });

    test('the Your rhythm dialog only carries study hours and pace', () => {
        expect(Object.keys(rhythmForm({ studyHoursPerDay: 5, wellbeingGoal: 'steady' })).sort()).toEqual(['studyHoursPerDay', 'wellbeingGoal']);
    });

    test('an empty wake time adds no odd option to the picker', () => {
        const { wakeTimes } = rhythmOptions({ usualWakeTime: '' });
        expect(wakeTimes.every((option) => option.value !== '')).toBe(true);
    });
});

describe('Your rhythm chips', () => {
    test('show study hours and pace only', () => {
        expect(rhythmChips({ studyHoursPerDay: 3, sleepHours: 8, travelMinutesPerDay: 40, wellbeingGoal: 'steady' }))
            .toEqual(['3h study a day', 'Balanced pace']);
    });
});

describe('sleepSummary first run', () => {
    const base = { week: [], profile: { sleepHours: 8, hasRegularSleepSchedule: true, usualSleepStart: '23:00', travelMinutesPerDay: 0 } };

    test('without a wake time it aims for the hours and asks for one', () => {
        const summary = sleepSummary({ ...base, usualWakeTime: '' });
        expect(summary.headline).toBe('Aim for 8 hours of sleep');
        expect(summary.window).toBeNull();
        expect(summary.note).toContain('wake time');
    });

    test('with a wake time the usual window shows', () => {
        const summary = sleepSummary({ ...base, usualWakeTime: '07:00' });
        expect(summary.window).toEqual({ bed: '11:00 PM', wake: '7:00 AM' });
    });
});

describe('sleepExplainerPoints', () => {
    test('six points, with the student\'s own numbers in point 4', () => {
        const points = sleepExplainerPoints({ window: { bed: '10:45 pm', wake: '6:45 am' }, target: 8 });
        expect(points).toHaveLength(6);
        expect(points[3].text).toBe('A bedtime, a wake time and the hours between them. Tonight: bed by 10:45 pm, up at 6:45 am, 8 h.');
    });

    test('with no window point 4 asks for a wake time', () => {
        expect(sleepExplainerPoints({ window: null, target: 8 })[3].text).toContain('Pick a wake time above to see yours.');
    });
});
