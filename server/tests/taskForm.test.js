import { describe, test, expect } from 'vitest';
import {
    NO_SUBJECT, emptyTaskForm, sizeOf, taskChanges, taskFormFrom, taskPayload, taskStarted,
} from '../../client/src/features/tasks/taskForm.js';

const stored = {
    _id: 'a'.repeat(24),
    title: 'Chapter 3 draft',
    course: 'Capstone',
    description: 'Methodology section.',
    dueDate: '2026-11-12T00:00:00.000Z',
    hours: 2,
};
const subjectId = 'b'.repeat(24);

describe('taskFormFrom', () => {
    test('reads the stored task back, due day in UTC, hours as stored', () => {
        expect(taskFormFrom(stored, subjectId)).toEqual({
            title: 'Chapter 3 draft', subject: subjectId, dueDate: '2026-11-12', hours: 2, description: 'Methodology section.',
        });
    });

    test('a task with no subject or notes starts empty', () => {
        const form = taskFormFrom({ ...stored, description: undefined });
        expect(form.subject).toBe(NO_SUBJECT);
        expect(form.description).toBe('');
    });

    test('a due date in the past stays editable', () => {
        expect(taskFormFrom({ ...stored, dueDate: '2020-01-01T00:00:00.000Z' }).dueDate).toBe('2020-01-01');
    });
});

describe('taskChanges', () => {
    const start = taskFormFrom(stored, subjectId);

    test('no edits means no changes', () => {
        expect(taskChanges(start, { ...start })).toEqual({});
    });

    test('title only sends title, trimmed and tidied', () => {
        expect(taskChanges(start, { ...start, title: '  Chapter   4 draft ' })).toEqual({ title: 'Chapter 4 draft' });
    });

    test('a new subject sends the id and never the course', () => {
        const changes = taskChanges(start, { ...start, subject: 'c'.repeat(24) });
        expect(changes).toEqual({ subject: 'c'.repeat(24) });
        expect(changes).not.toHaveProperty('course');
    });

    test('No subject unlinks and clears the old course label', () => {
        expect(taskChanges(start, { ...start, subject: NO_SUBJECT })).toEqual({ subject: null, course: '' });
    });

    test('hours stay out of the request until a size is picked', () => {
        expect(taskChanges(start, { ...start, title: 'New' })).not.toHaveProperty('hours');
        expect(taskChanges(start, { ...start, hours: 5 })).toEqual({ hours: 5 });
    });

    test('notes are trimmed, and clearing them sends an empty string', () => {
        expect(taskChanges(start, { ...start, description: '  Use five sources.  ' })).toEqual({ description: 'Use five sources.' });
        expect(taskChanges(start, { ...start, description: '' })).toEqual({ description: '' });
        expect(taskChanges(start, { ...start, description: 'Methodology section.  ' })).toEqual({});
    });

    test('due date changes alone', () => {
        expect(taskChanges(start, { ...start, dueDate: '2026-11-20' })).toEqual({ dueDate: '2026-11-20' });
    });
});

describe('create', () => {
    test('payload carries trimmed notes', () => {
        const form = { ...emptyTaskForm(new Date('2026-11-09T12:00:00')), title: ' Lab ', description: ' bring gown ' };
        expect(taskPayload(form)).toMatchObject({ title: 'Lab', description: 'bring gown', subject: null, hours: 3 });
    });

    test('a form with only notes typed still asks before closing', () => {
        expect(taskStarted({ ...emptyTaskForm(), description: 'x' })).toBe(true);
        expect(taskStarted(emptyTaskForm())).toBe(false);
    });
});

describe('sizeOf', () => {
    test.each([[0.5, 1], [1.5, 1], [2, 3], [4, 3], [4.5, 5], [24, 5]])('%s hours shows size %s', (hours, size) => {
        expect(sizeOf(hours)).toBe(size);
    });
});
