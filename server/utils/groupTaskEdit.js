import groupTaskModel from '../models/groupTaskModel.js';
import { getTaskUpdatePayload } from '../controllers/taskController.js';

// Field-level compare-and-set for group tasks. A PATCH sends { changes, expected }: the new value
// of each field it changes, and the value that field had when the form opened. Two admins changing
// different fields both keep their edits; changing the same field to different values stops the
// second one with a conflict instead of silently overwriting the first.

// The fields a group task edit may change, and how `expected` values are typed for comparing.
const FIELD_TYPES = {
    title: 'string',
    course: 'string',
    description: 'string',
    dueDate: 'date',
    hours: 'number',
    difficulty: 'number',
    importance: 'number',
    isCompleted: 'boolean',
};

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// Only plain values of the field's own type, so nothing like { $ne: ... } can reach a query filter.
const CASTS = {
    string: (value) => (typeof value === 'string' ? value : undefined),
    number: (value) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined),
    boolean: (value) => (typeof value === 'boolean' ? value : undefined),
    date: (value) => {
        if (typeof value !== 'string') return undefined;
        const date = new Date(value);
        return Number.isFinite(date.getTime()) ? date : undefined;
    },
};

const INVALID_EDIT = { error: "That edit couldn't be read. Reload and try again." };

// { fields, expected } from a PATCH body, or { error }. `changes` goes through the same checks as a
// personal task edit; `expected` must hold exactly the same keys.
export const readTaskEdit = ({ changes, expected }) => {
    if (!isPlainObject(changes) || !isPlainObject(expected)) return INVALID_EDIT;
    if (!Object.keys(changes).every((key) => Object.hasOwn(FIELD_TYPES, key))) return INVALID_EDIT;

    const { fields, error } = getTaskUpdatePayload(changes);
    if (error) return { error };
    const keys = Object.keys(fields);
    if (!keys.length) return { error: 'Nothing to change.' };
    if (Object.keys(expected).length !== keys.length || !keys.every((key) => Object.hasOwn(expected, key))) return INVALID_EDIT;

    const was = {};
    for (const key of keys) {
        const value = CASTS[FIELD_TYPES[key]](expected[key]);
        if (value === undefined) return INVALID_EDIT;
        was[key] = value;
    }
    return { fields, expected: was };
};

const sameValue = (a, b) => {
    if (a instanceof Date || b instanceof Date) return a != null && b != null && new Date(a).getTime() === new Date(b).getTime();
    return a === b;
};

const pick = (source, keys) => Object.fromEntries(keys.map((key) => [key, source[key]]));

// The update that moves `fields` on from `before`, the values the update's filter guarantees.
// completedAt and completedBy follow isCompleted only when it really changes.
const updateFor = (fields, before, userId) => {
    const set = { ...fields, updatedBy: userId };
    if (fields.isCompleted !== undefined && fields.isCompleted !== before.isCompleted) {
        set.completedAt = fields.isCompleted ? new Date() : null;
        set.completedBy = fields.isCompleted ? userId : null;
    }
    return { $set: set };
};

// One try with the client's view, and one more with the current values when the only difference
// is a field someone else already set the same way, or a field this edit doesn't touch.
const ATTEMPTS = 2;

// Applies an edit read by readTaskEdit. Resolves to one of
//   { status: 'saved', task }               the edit is stored
//   { status: 'unchanged', task }           someone else already made exactly this change
//   { status: 'conflict', task, conflicts } another edit changed these fields to something else
//   { status: 'gone' }                      the task was deleted
export const editGroupTask = async ({ groupId, taskId, fields, expected, userId }) => {
    const keys = Object.keys(fields);
    const target = { _id: taskId, group: groupId };
    let pending = fields;
    let before = expected;

    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
        const saved = await groupTaskModel.findOneAndUpdate(
            { ...target, ...before },
            updateFor(pending, before, userId),
            { returnDocument: 'after' }
        );
        if (saved) return { status: 'saved', task: saved };

        const current = await groupTaskModel.findOne(target);
        if (!current) return { status: 'gone' };
        const conflicts = keys.filter((key) => !sameValue(current[key], expected[key]) && !sameValue(current[key], fields[key]));
        if (conflicts.length) return { status: 'conflict', task: current, conflicts };

        const left = keys.filter((key) => !sameValue(current[key], fields[key]));
        if (!left.length) return { status: 'unchanged', task: current };
        pending = pick(fields, left);
        before = pick(current, left);
    }

    // Still moving under us after both tries: report whatever no longer matches what the client saw.
    const current = await groupTaskModel.findOne(target);
    if (!current) return { status: 'gone' };
    return { status: 'conflict', task: current, conflicts: keys.filter((key) => !sameValue(current[key], expected[key])) };
};
