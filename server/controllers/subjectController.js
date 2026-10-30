import mongoose from 'mongoose';
import subjectModel, { SUBJECT_COLORS, SUBJECT_LIMITS } from '../models/subjectModel.js';
import taskModel from '../models/taskModel.js';
import reviewerModel from '../models/reviewerModel.js';
import scheduleModel from '../models/scheduleModel.js';
import { isId, serverError } from '../utils/httpErrors.js';
import { courseKey, activeSubjects } from '../utils/subjectMatch.js';
import { linkMatchingItems, relabelLinkedItems, unlinkItems } from '../utils/subjectCascade.js';

const MAX_SUGGESTIONS = 15;
const SUGGESTED_ENTRY_KINDS = ['class', 'exam'];

const notFound = (res) => res.status(404).json({ success: false, message: 'Subject not found' });
const bad = (res, message, status = 400) => res.status(status).json({ success: false, message });
const text = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');
const asObjectId = (id) => new mongoose.Types.ObjectId(String(id));

// Open tasks and reviewers per subject: one aggregate for each, not one query per subject.
const countsFor = async (owner, subjectIds) => {
    if (!subjectIds.length) return new Map();
    const countBy = (model, extra = {}) => model.aggregate([
        { $match: { owner: asObjectId(owner), subject: { $in: subjectIds }, ...extra } },
        { $group: { _id: '$subject', n: { $sum: 1 } } },
    ]);
    const [tasks, reviewers] = await Promise.all([countBy(taskModel, { isCompleted: false }), countBy(reviewerModel)]);
    const counts = new Map(subjectIds.map((id) => [String(id), { openTasks: 0, reviewers: 0 }]));
    tasks.forEach((row) => { counts.get(String(row._id)).openTasks = row.n; });
    reviewers.forEach((row) => { counts.get(String(row._id)).reviewers = row.n; });
    return counts;
};

const publicSubject = (subject, counts) => ({
    _id: subject._id,
    name: subject.name,
    code: subject.code,
    term: subject.term,
    color: subject.color,
    order: subject.order,
    archivedAt: subject.archivedAt,
    counts: counts || { openTasks: 0, reviewers: 0 },
});

const sameNameTaken = async (owner, name, exceptId = null) => {
    const key = courseKey(name);
    if (!key) return null;
    const subjects = await activeSubjects(owner);
    return subjects.find((s) => String(s._id) !== String(exceptId) && courseKey(s.name) === key) || null;
};

// Checks the fields that were sent. `partial` is true for a PATCH.
const readFields = (body, { partial }) => {
    const fields = {};
    const limits = SUBJECT_LIMITS;
    if (!partial || body.name !== undefined) {
        const name = text(body.name);
        if (!name) return { error: 'Give the subject a name.' };
        if (name.length > limits.name) return { error: `The name can be up to ${limits.name} characters.` };
        fields.name = name;
    }
    for (const key of ['code', 'term']) {
        if (body[key] === undefined) continue;
        const value = text(body[key]);
        if (value.length > limits[key]) return { error: `The ${key} can be up to ${limits[key]} characters.` };
        fields[key] = value;
    }
    if (body.color !== undefined) {
        if (!SUBJECT_COLORS.includes(body.color)) return { error: 'Pick one of the colours.' };
        fields.color = body.color;
    }
    return { fields };
};

// The first colour no active subject uses, or the next one in turn when all eight are taken.
const nextColor = (subjects) => {
    const used = new Set(subjects.map((s) => s.color));
    return SUBJECT_COLORS.find((c) => !used.has(c)) || SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length];
};

export const getSubjects = async (req, res) => {
    try {
        const archived = req.query.archived === '1';
        const subjects = await subjectModel
            .find({ owner: req.userId, archivedAt: archived ? { $ne: null } : null })
            .sort({ order: 1, createdAt: 1 });
        const counts = await countsFor(req.userId, subjects.map((s) => s._id));
        res.json({ success: true, subjects: subjects.map((s) => publicSubject(s, counts.get(String(s._id)))) });
    } catch (error) {
        serverError(res, 'getSubjects error', error);
    }
};

export const createSubject = async (req, res) => {
    try {
        const { fields, error } = readFields(req.body, { partial: false });
        if (error) return bad(res, error);

        const subjects = await activeSubjects(req.userId);
        if (subjects.length >= SUBJECT_LIMITS.maxActive) {
            return bad(res, `You can have up to ${SUBJECT_LIMITS.maxActive} subjects. Delete one you no longer need first.`);
        }
        if (await sameNameTaken(req.userId, fields.name)) {
            return bad(res, `You already have a subject called ${fields.name}.`, 409);
        }

        const subject = await subjectModel.create({
            ...fields,
            color: fields.color || nextColor(subjects),
            owner: req.userId,
            order: subjects.length ? Math.max(...subjects.map((s) => s.order)) + 1 : 0,
        });
        const linked = await linkMatchingItems(subject);
        res.status(201).json({
            success: true,
            subject: publicSubject(subject, { openTasks: linked.tasks, reviewers: linked.reviewers }),
            linked,
        });
    } catch (error) {
        serverError(res, 'createSubject error', error);
    }
};

// Course labels the student already uses, which they can turn into subjects in one tap.
export const getSuggestions = async (req, res) => {
    try {
        const [subjects, tasks, reviewers, schedules] = await Promise.all([
            subjectModel.find({ owner: req.userId }).select('name code').lean(),
            taskModel.find({ owner: req.userId, subject: null }).select('course').lean(),
            reviewerModel.find({ owner: req.userId, subject: null }).select('course').lean(),
            scheduleModel.find({ owner: req.userId }).select('entries.title entries.kind').lean(),
        ]);

        const known = new Set(subjects.flatMap((s) => [courseKey(s.name), courseKey(s.code)]));
        const found = new Map();
        const add = (label, source) => {
            const clean = text(label);
            const key = courseKey(clean);
            if (!key || known.has(key)) return;
            const entry = found.get(key) || { label: clean, key, sources: [], count: 0 };
            if (!entry.sources.includes(source)) entry.sources.push(source);
            entry.count += 1;
            found.set(key, entry);
        };
        tasks.forEach((t) => add(t.course, 'tasks'));
        reviewers.forEach((r) => add(r.course, 'reviewers'));
        schedules.forEach((s) => s.entries
            .filter((e) => SUGGESTED_ENTRY_KINDS.includes(e.kind))
            .forEach((e) => add(e.title, 'schedule')));

        const suggestions = [...found.values()]
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
            .slice(0, MAX_SUGGESTIONS);
        res.json({ success: true, suggestions });
    } catch (error) {
        serverError(res, 'getSuggestions error', error);
    }
};

export const reorderSubjects = async (req, res) => {
    try {
        const subjects = await activeSubjects(req.userId);
        const mine = new Set(subjects.map((s) => String(s._id)));
        const sent = Array.isArray(req.body.ids) ? req.body.ids.map(String) : [];
        if (sent.length !== mine.size || new Set(sent).size !== sent.length || !sent.every((id) => mine.has(id))) {
            return bad(res, 'Send each of your subjects once.');
        }
        await subjectModel.bulkWrite(sent.map((id, order) => ({
            updateOne: { filter: { _id: id, owner: req.userId }, update: { $set: { order } } },
        })));
        res.json({ success: true });
    } catch (error) {
        serverError(res, 'reorderSubjects error', error);
    }
};

const findOwned = (req) => (
    isId(req.params.id) ? subjectModel.findOne({ _id: req.params.id, owner: req.userId }) : null
);

export const getSubject = async (req, res) => {
    try {
        const subject = await findOwned(req);
        if (!subject) return notFound(res);
        const counts = await countsFor(req.userId, [subject._id]);
        res.json({ success: true, subject: publicSubject(subject, counts.get(String(subject._id))) });
    } catch (error) {
        serverError(res, 'getSubject error', error);
    }
};

export const updateSubject = async (req, res) => {
    try {
        const subject = await findOwned(req);
        if (!subject) return notFound(res);
        const { fields, error } = readFields(req.body, { partial: true });
        if (error) return bad(res, error);

        if (fields.name && !subject.archivedAt && await sameNameTaken(req.userId, fields.name, subject._id)) {
            return bad(res, `You already have a subject called ${fields.name}.`, 409);
        }

        const labelChanged = ['name', 'code'].some((key) => fields[key] !== undefined && fields[key] !== subject[key]);
        Object.assign(subject, fields);
        await subject.save();

        let linked = { tasks: 0, reviewers: 0 };
        if (labelChanged) {
            await relabelLinkedItems(subject);
            linked = await linkMatchingItems(subject);
        }
        const counts = await countsFor(req.userId, [subject._id]);
        res.json({ success: true, subject: publicSubject(subject, counts.get(String(subject._id))), linked });
    } catch (error) {
        serverError(res, 'updateSubject error', error);
    }
};

export const deleteSubject = async (req, res) => {
    try {
        const subject = await findOwned(req);
        if (!subject) return notFound(res);
        await unlinkItems(subject);
        await subject.deleteOne();
        res.json({ success: true });
    } catch (error) {
        serverError(res, 'deleteSubject error', error);
    }
};
