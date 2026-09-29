import { describe, test, expect } from 'vitest';
import {
    buildWeek, computeWorkload, getTaskMetrics, surveyStatus, PSS_VALID_DAYS, WHO_VALID_DAYS,
} from '../../client/src/utils/workload.js';
import { buildFocus, phaseFor } from '../../client/src/utils/todayFocus.js';

// Wednesday 30 Sep 2026, 10:30 local time.
const at = (h, m = 0, dayOffset = 0) => new Date(2026, 8, 30 + dayOffset, h, m);
const NOW = at(10, 30);
const isoDay = (offset) => {
    const d = new Date(2026, 8, 30 + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();

const task = (overrides = {}) => ({
    _id: 't1', title: 'Essay', course: 'ENG 101', dueDate: isoDay(3), hours: 4, difficulty: 3, importance: 3, ...overrides,
});
const profile = { studyHoursPerDay: 4, wellbeingGoal: 'steady' };

// A week overview like the server sends it, with the given entries on day 0 and 1.
const overview = (today = [], tomorrow = []) => ({
    scheduleCount: 1,
    entryCount: today.length + tomorrow.length,
    days: [today, tomorrow].map((entries, i) => ({
        date: isoDay(i),
        entries,
        holiday: null,
        classHours: entries.reduce((s, e) => s + (parseInt(e.endTime) - parseInt(e.startTime)), 0),
        activityHours: 0,
        busyHours: entries.reduce((s, e) => s + (parseInt(e.endTime) - parseInt(e.startTime)), 0),
    })),
});
const cls = (title, startTime, endTime) => ({ kind: 'class', title, startTime, endTime });

const run = ({ tasks = [], entries = [[], []], pss = null, who = null, pssLast = null, whoLast = null } = {}) => {
    const week = buildWeek(tasks, profile, entries ? overview(...entries) : null, NOW);
    const p = surveyStatus(pss, pssLast, PSS_VALID_DAYS, NOW);
    const w = surveyStatus(who, whoLast, WHO_VALID_DAYS, NOW);
    return computeWorkload({
        tasks, profile, days: week, pssScore: p.score, whoScore: w.score, hasSchedule: Boolean(entries && (entries[0].length + entries[1].length)),
        pssStatus: p.status, whoStatus: w.status, pssAgeDays: p.ageDays, whoAgeDays: w.ageDays, now: NOW,
    });
};

describe('check-ins that are out of date', () => {
    test('a fresh score counts, an old one comes back as no data', () => {
        expect(surveyStatus(20, daysAgo(5), PSS_VALID_DAYS, NOW)).toMatchObject({ status: 'fresh', score: 20 });
        expect(surveyStatus(20, daysAgo(45), PSS_VALID_DAYS, NOW)).toMatchObject({ status: 'stale', score: null, ageDays: 45 });
        expect(surveyStatus(null, null, PSS_VALID_DAYS, NOW)).toMatchObject({ status: 'never', score: null });
    });

    test('WHO-5 goes stale after 14 days, PSS after 30', () => {
        expect(surveyStatus(60, daysAgo(13), WHO_VALID_DAYS, NOW).status).toBe('fresh');
        expect(surveyStatus(60, daysAgo(14), WHO_VALID_DAYS, NOW).status).toBe('stale');
        expect(surveyStatus(20, daysAgo(29), PSS_VALID_DAYS, NOW).status).toBe('fresh');
        expect(surveyStatus(20, daysAgo(30), PSS_VALID_DAYS, NOW).status).toBe('stale');
    });

    test('an old high PSS does not raise the score once it has expired', () => {
        const tasks = [task()];
        const fresh = run({ tasks, pss: 38, pssLast: daysAgo(3) });
        const stale = run({ tasks, pss: 38, pssLast: daysAgo(40) });
        const never = run({ tasks });
        expect(fresh.workloadScore).toBeGreaterThan(stale.workloadScore);
        expect(stale.workloadScore).toBe(never.workloadScore);
        expect(stale.parts.some((p) => p.key === 'stress')).toBe(false);
    });

    test('the guidance says the check-in is out of date', () => {
        const result = run({ tasks: [task()], pss: 38, pssLast: daysAgo(40) });
        const tip = result.tips.find((t) => t.title === 'Time for a fresh check-in');
        expect(tip.text).toContain('40 days old');
        expect(result.tips.some((t) => t.title === 'Stress is running high')).toBe(false);
    });
});

describe('guidance follows what the student has', () => {
    const titles = (result) => result.tips.map((t) => t.title);

    test('with no tasks it does not talk about deadlines', () => {
        const result = run({ entries: [[cls('Calculus', '09:00', '11:00')], []] });
        expect(titles(result)).toContain('Nothing on your task list');
        expect(titles(result).some((t) => t.startsWith('Next deadline'))).toBe(false);
    });

    test('with tasks it names the next deadline and a sensible daily amount', () => {
        const result = run({ tasks: [task({ title: 'Lab report', dueDate: isoDay(4), hours: 6 })] });
        const tip = result.tips.find((t) => t.title === 'Next deadline: Lab report');
        expect(tip.text).toContain('Due in 4 days');
        expect(tip.text).toContain('1.5h a day');
    });

    test('with no timetable it asks for one', () => {
        const result = run({ tasks: [task()], entries: null });
        expect(titles(result)).toContain('Add your class schedule');
    });

    test('high stress on a light week points at something other than the workload', () => {
        const result = run({ tasks: [task({ hours: 1, dueDate: isoDay(6) })], pss: 33, pssLast: daysAgo(2) });
        const tip = result.tips.find((t) => t.title === 'Stress is running high');
        expect(tip.text).toContain("isn't heavy");
    });

    test('high stress on a heavy week gets study-technique advice instead', () => {
        const tasks = [task({ hours: 14, dueDate: isoDay(1) }), task({ _id: 't2', title: 'Report', hours: 10, dueDate: isoDay(2) })];
        const result = run({ tasks, pss: 33, pssLast: daysAgo(2) });
        const tip = result.tips.find((t) => t.title === 'Stress is running high');
        expect(tip.text).toContain('25-minute');
    });

    test('very low well-being is an alert', () => {
        const result = run({ tasks: [task()], who: 20, whoLast: daysAgo(2) });
        expect(result.tips.find((t) => t.title === 'Your well-being is very low').tone).toBe('alert');
    });

    test('an early class tomorrow gets a sleep reminder', () => {
        const result = run({ tasks: [task()], entries: [[cls('Physics', '13:00', '14:00')], [cls('Biology', '07:30', '09:00')]] });
        const tip = result.tips.find((t) => t.title === 'Early start tomorrow');
        expect(tip.text).toContain('Biology starts at 7:30 AM');
    });

    test('a long gap between classes is offered for the next task', () => {
        const result = run({ tasks: [task({ title: 'Essay' })], entries: [[cls('Math', '08:00', '09:00'), cls('Chem', '14:00', '15:00')], []] });
        const tip = result.tips.find((t) => t.title === 'Today has a free window');
        expect(tip.text).toContain('Essay');
        expect(tip.text).toContain('3h 30m');
    });

    test('never shows more than five tips', () => {
        const tasks = [task({ hours: 30, dueDate: isoDay(-1) }), task({ _id: 't2', hours: 20, dueDate: isoDay(1), difficulty: 5, importance: 5 })];
        const result = run({ tasks, pss: 35, pssLast: daysAgo(1), who: 15, whoLast: daysAgo(1) });
        expect(result.tips.length).toBeLessThanOrEqual(5);
    });
});

describe('the today panel follows the clock', () => {
    const day = (entries) => ({ entries, holiday: null });
    const enriched = (tasks, now = NOW) => tasks.map((t) => ({ ...t, ...getTaskMetrics(t, now) }));
    const classes = [cls('Math', '08:00', '09:30'), cls('Physics', '10:00', '11:30'), cls('Chem', '14:00', '15:30')];

    test('splits classes into now, later and finished', () => {
        const focus = buildFocus({ today: day(classes), tomorrow: day([]), tasks: [], now: NOW });
        expect(focus.happeningNow.map((e) => e.title)).toEqual(['Physics']);
        expect(focus.laterToday.map((e) => e.title)).toEqual(['Chem']);
        expect(focus.finishedCount).toBe(1);
        expect(focus.heading).toBe('Happening now');
    });

    test('later in the day earlier classes drop away and tomorrow appears', () => {
        const evening = at(18, 0);
        const focus = buildFocus({
            today: day(classes), tomorrow: day([cls('Bio', '07:30', '09:00')]), tasks: [], now: evening,
        });
        expect(focus.happeningNow).toHaveLength(0);
        expect(focus.laterToday).toHaveLength(0);
        expect(focus.heading).toBe('Done for the day');
        expect(focus.tomorrow.entries.map((e) => e.title)).toEqual(['Bio']);
        expect(focus.kicker).toBe('This evening');
    });

    test('mid-morning does not show tomorrow while there is still a day ahead', () => {
        const focus = buildFocus({ today: day(classes), tomorrow: day([]), tasks: [], now: at(8, 30) });
        expect(focus.tomorrow).toBeNull();
        expect(focus.kicker).toBe('This morning');
    });

    test('with no open tasks it is all caught up', () => {
        const focus = buildFocus({ today: day([]), tomorrow: day([]), tasks: [], now: NOW });
        expect(focus.caughtUp).toBe(true);
        expect(focus.heading).toBe('Nothing pressing');
    });

    test('lists overdue and due-soon tasks first and finds the next later deadline', () => {
        const tasks = enriched([
            task({ _id: 'a', title: 'Far', dueDate: isoDay(5) }),
            task({ _id: 'b', title: 'Soon', dueDate: isoDay(1) }),
            task({ _id: 'c', title: 'Late', dueDate: isoDay(-1) }),
        ]);
        const focus = buildFocus({ today: day([]), tomorrow: day([]), tasks, now: NOW });
        expect(focus.dueSoon.map((t) => t.title)).toEqual(['Late', 'Soon']);
        expect(focus.nextTask.title).toBe('Far');
        expect(focus.caughtUp).toBe(false);
    });

    test('phases', () => {
        expect(phaseFor(at(7))).toBe('morning');
        expect(phaseFor(at(13))).toBe('afternoon');
        expect(phaseFor(at(19))).toBe('evening');
        expect(phaseFor(at(23))).toBe('night');
        expect(phaseFor(at(2))).toBe('night');
    });
});
