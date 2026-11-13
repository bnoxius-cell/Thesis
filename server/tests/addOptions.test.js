import { describe, expect, it } from 'vitest';
import { ADD_OPTIONS, addGroupFor, addSections, addedToast } from '../../client/src/app/shell/add/addOptions.js';

// Wednesday 2026-11-11, local time.
const today = new Date(2026, 10, 11);

describe('addGroupFor', () => {
    it('lists Study first on Study and everything under it', () => {
        expect(addGroupFor('/study')).toBe('study');
        expect(addGroupFor('/study/subjects/abc')).toBe('study');
        expect(addGroupFor('/study/practice')).toBe('study');
    });

    it('lists Plan first everywhere else, Home included', () => {
        for (const path of ['/home', '/plan', '/wellbeing', '/studying', '/notifications']) {
            expect(addGroupFor(path)).toBe('plan');
        }
    });
});

describe('addSections', () => {
    it('puts the page group first and the rest under "Everything else"', () => {
        const [first, rest] = addSections('/study');
        expect(first.heading).toBe('Study');
        expect(first.rows.map((row) => row.kind)).toEqual(['subject', 'reviewer']);
        expect(rest.heading).toBe('Everything else');
        expect(rest.rows.map((row) => row.kind)).toEqual(['task', 'class', 'exam', 'event', 'activity']);
    });

    it('offers every option exactly once on any page', () => {
        for (const path of ['/home', '/plan', '/study']) {
            const kinds = addSections(path).flatMap((section) => section.rows.map((row) => row.kind));
            expect([...kinds].sort()).toEqual(ADD_OPTIONS.map((option) => option.kind).sort());
        }
    });
});

describe('addedToast', () => {
    it('sends a task to its place in Tasks', () => {
        const toast = addedToast('task', { _id: 't1' }, today);
        expect(toast.message).toBe('Task added to Plan');
        expect(toast.href).toBe('/plan?view=tasks&task=t1');
    });

    it('sends a subject to its page', () => {
        expect(addedToast('subject', { _id: 's1' }, today)).toEqual({
            message: 'Subject added to Study',
            href: '/study/subjects/s1',
        });
    });

    it('sends a reviewer to Practice, where it shows as processing', () => {
        expect(addedToast('reviewer', undefined, today)).toEqual({
            message: 'Making your reviewer',
            href: '/study/practice',
        });
    });

    it('opens a one-off entry on its own day', () => {
        const toast = addedToast('exam', { entry: { date: '2026-11-20' } }, today);
        expect(toast.message).toBe('Exam added to Plan');
        expect(toast.href).toBe('/plan?week=2026-11-16&day=2026-11-20');
    });

    it('opens a weekly entry on the next day it falls on, today included', () => {
        // Wednesday is day 3, Friday 5.
        expect(addedToast('class', { entry: { days: [3, 5] } }, today).href).toBe('/plan?day=2026-11-11');
        expect(addedToast('activity', { entry: { days: [1, 5] } }, today).href).toBe('/plan?day=2026-11-13');
        // Monday next week.
        expect(addedToast('event', { entry: { days: [1] } }, today).href).toBe('/plan?week=2026-11-16&day=2026-11-16');
    });
});
