import taskModel from '../models/taskModel.js';
import taskShareModel from '../models/taskShareModel.js';
import mongoose from 'mongoose';
import { isId, serverError } from '../utils/httpErrors.js';

const generateShareTag = () => String(Math.floor(100000 + Math.random() * 900000));

const getSharePayloadFromTask = (task) => ({
    title: task.title,
    course: task.course,
    description: task.description || '',
    dueDate: task.dueDate,
    hours: task.hours,
    difficulty: task.difficulty,
    importance: task.importance,
});

export const TASK_LIMITS = { title: 120, course: 80, description: 1000, minHours: 0.5, maxHours: 24 };
const HOURS_MESSAGE = `Estimated hours can be ${TASK_LIMITS.minHours} to ${TASK_LIMITS.maxHours}.`;

const text = (value) => (typeof value === 'string' ? value.trim() : '');

const getTaskPayload = (body) => {
    const title = text(body.title);
    const course = text(body.course);
    const description = text(body.description);
    const dueDate = body.dueDate ? new Date(body.dueDate) : null;
    const hours = Number(body.hours ?? 3);
    const difficulty = Number(body.difficulty ?? 3);
    const importance = Number(body.importance ?? 3);

    if (!title || !body.dueDate) {
        return { error: 'Title and due date are required.' };
    }

    if (!Number.isFinite(dueDate?.getTime())) {
        return { error: 'Please provide a valid due date.' };
    }

    if (title.length > TASK_LIMITS.title) return { error: `The title can be up to ${TASK_LIMITS.title} characters.` };
    if (course.length > TASK_LIMITS.course) return { error: `The course can be up to ${TASK_LIMITS.course} characters.` };
    if (description.length > TASK_LIMITS.description) return { error: `The description can be up to ${TASK_LIMITS.description} characters.` };

    if (!Number.isFinite(hours) || hours < TASK_LIMITS.minHours || hours > TASK_LIMITS.maxHours) {
        return { error: HOURS_MESSAGE };
    }

    if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > 5) {
        return { error: 'Difficulty must be between 1 and 5.' };
    }

    if (!Number.isFinite(importance) || importance < 1 || importance > 5) {
        return { error: 'Importance must be between 1 and 5.' };
    }

    return {
        payload: {
            title,
            course,
            description,
            dueDate,
            hours,
            difficulty,
            importance,
        },
    };
};

const createShareTemplate = async (payload, userId) => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
        const shareTag = generateShareTag();
        const existing = await taskShareModel.exists({ shareTag });
        if (!existing) {
            return taskShareModel.create({ ...payload, shareTag, createdBy: userId });
        }
    }
    throw new Error('Unable to generate a unique task code.');
};

export const ensureShareTemplateForTask = async (task) => {
    if (task.shareTag) {
        const existingTemplate = await taskShareModel.findOne({ shareTag: task.shareTag });
        if (existingTemplate) return existingTemplate;

        try {
            return await taskShareModel.create({
                shareTag: task.shareTag,
                ...getSharePayloadFromTask(task),
                createdBy: task.owner,
            });
        } catch (error) {
            if (error.code !== 11000) throw error;
            return taskShareModel.findOne({ shareTag: task.shareTag });
        }
    }

    const template = await createShareTemplate(getSharePayloadFromTask(task), task.owner);
    task.shareTag = template.shareTag;
    await task.save();
    return template;
};

// Same checks as getTaskPayload, but only for the fields that were sent.
const getTaskUpdatePayload = (body) => {
    const fields = {};
    const fail = (error) => ({ error });

    if (body.title !== undefined) {
        const value = text(body.title);
        if (!value) return fail("The title can't be empty.");
        if (value.length > TASK_LIMITS.title) return fail(`The title can be up to ${TASK_LIMITS.title} characters.`);
        fields.title = value;
    }
    // The course is optional: an empty string clears it ("No course").
    if (body.course !== undefined) {
        const value = text(body.course);
        if (value.length > TASK_LIMITS.course) return fail(`The course can be up to ${TASK_LIMITS.course} characters.`);
        fields.course = value;
    }
    if (body.description !== undefined) {
        const value = text(body.description);
        if (value.length > TASK_LIMITS.description) return fail(`The description can be up to ${TASK_LIMITS.description} characters.`);
        fields.description = value;
    }
    if (body.dueDate !== undefined) {
        const due = new Date(body.dueDate);
        if (!body.dueDate || !Number.isFinite(due.getTime())) return fail('Please provide a valid due date.');
        fields.dueDate = due;
    }
    if (body.hours !== undefined) {
        const hours = Number(body.hours);
        if (!Number.isFinite(hours) || hours < TASK_LIMITS.minHours || hours > TASK_LIMITS.maxHours) return fail(HOURS_MESSAGE);
        fields.hours = hours;
    }
    for (const key of ['difficulty', 'importance']) {
        if (body[key] === undefined) continue;
        const value = Number(body[key]);
        if (!Number.isFinite(value) || value < 1 || value > 5) return fail(`${key[0].toUpperCase()}${key.slice(1)} must be between 1 and 5.`);
        fields[key] = value;
    }
    if (body.isCompleted !== undefined) fields.isCompleted = Boolean(body.isCompleted);

    return { fields };
};

const findShareTemplateByTag = async (shareTag) => {
    let template = await taskShareModel.findOne({ shareTag });
    if (template) return template;

    const legacyTask = await taskModel.findOne({ shareTag });
    if (!legacyTask) return null;

    return ensureShareTemplateForTask(legacyTask);
};

const sameTaskDetails = (payload, template) => (
    payload.title === template.title
    && payload.course === template.course
    && payload.description === (template.description || '')
    && new Date(payload.dueDate).getTime() === new Date(template.dueDate).getTime()
    && Number(payload.hours) === Number(template.hours)
    && Number(payload.difficulty) === Number(template.difficulty)
    && Number(payload.importance) === Number(template.importance)
);

export const createTask = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.userId)) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { payload, error } = getTaskPayload(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        let shareTag = null;

        if (req.body.shareTag) {
            const normalizedShareTag = String(req.body.shareTag).trim();
            if (!/^\d{6}$/.test(normalizedShareTag)) {
                return res.status(400).json({ success: false, message: 'Please enter a valid 6-digit task code.' });
            }

            const template = await findShareTemplateByTag(normalizedShareTag);
            if (!template) {
                return res.status(404).json({ success: false, message: 'Task code not found.' });
            }
            if (sameTaskDetails(payload, template)) {
                shareTag = template.shareTag;
            } else {
                const editedTemplate = await createShareTemplate(payload, req.userId);
                shareTag = editedTemplate.shareTag;
            }
        } else {
            const template = await createShareTemplate(payload, req.userId);
            shareTag = template.shareTag;
        }

        const newTask = new taskModel({ ...payload, owner: req.userId, shareTag });
        await newTask.save();
        res.json({ success: true, message: 'Task created', task: newTask });
    } catch (error) {
        console.error('Create task error:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Task creation failed. Please try again.' });
    }
};

export const getTasks = async (req, res) => {
    try {
        const tasks = await taskModel.find({ owner: req.userId }).sort({ dueDate: 1 });
        await Promise.all(tasks.map((task) => ensureShareTemplateForTask(task)));
        res.json({ success: true, tasks });
    } catch (error) {
        serverError(res, 'getTasks error', error);
    }
};

export const getTaskByTag = async (req, res) => {
    try {
        const shareTag = String(req.params.shareTag || '').trim();
        if (!/^\d{6}$/.test(shareTag)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid 6-digit task code.' });
        }

        const template = await findShareTemplateByTag(shareTag);
        if (!template) return res.status(404).json({ success: false, message: 'Task code not found.' });

        // Two things worth knowing before adding it: do you already have it, and how
        // crowded is that day (open tasks due within a day either side).
        const due = new Date(template.dueDate);
        const from = new Date(due); from.setDate(from.getDate() - 1); from.setHours(0, 0, 0, 0);
        const to = new Date(due); to.setDate(to.getDate() + 1); to.setHours(23, 59, 59, 999);
        const [alreadyAdded, nearby] = await Promise.all([
            taskModel.exists({ owner: req.userId, shareTag }),
            taskModel.find({ owner: req.userId, isCompleted: false, dueDate: { $gte: from, $lte: to } })
                .select('title course dueDate hours').sort({ dueDate: 1 }).limit(6).lean(),
        ]);

        res.json({
            success: true,
            alreadyAdded: Boolean(alreadyAdded),
            nearby,
            task: {
                shareTag: template.shareTag,
                title: template.title,
                course: template.course,
                description: template.description,
                dueDate: template.dueDate,
                hours: template.hours,
                difficulty: template.difficulty,
                importance: template.importance,
            },
        });
    } catch (error) {
        serverError(res, 'getTaskByTag error', error);
    }
};

export const updateTask = async (req, res) => {
    try {
        if (!isId(req.params.taskId)) return res.status(404).json({ success: false, message: 'Task not found' });
        const { fields: updateFields, error } = getTaskUpdatePayload(req.body);
        if (error) return res.status(400).json({ success: false, message: error });
        const task = await taskModel.findOne({ _id: req.params.taskId, owner: req.userId });
        if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

        const wasCompleted = task.isCompleted;
        Object.assign(task, updateFields);
        if (updateFields.isCompleted !== undefined && updateFields.isCompleted !== wasCompleted) {
            task.completedAt = updateFields.isCompleted ? new Date() : null;
        }

        const detailFields = ['title', 'course', 'description', 'dueDate', 'hours', 'difficulty', 'importance'];
        const detailsChanged = detailFields.some((field) => updateFields[field] !== undefined);
        if (detailsChanged) {
            const template = await createShareTemplate(getSharePayloadFromTask(task), req.userId);
            task.shareTag = template.shareTag;
        }

        await task.save();
        res.json({ success: true, task });
    } catch (error) {
        serverError(res, 'updateTask error', error);
    }
};

export const deleteTask = async (req, res) => {
    try {
        if (!isId(req.params.taskId)) return res.status(404).json({ success: false, message: 'Task not found' });
        const task = await taskModel.findOneAndDelete({ _id: req.params.taskId, owner: req.userId });
        if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
        res.json({ success: true });
    } catch (error) {
        serverError(res, 'deleteTask error', error);
    }
};

export const importTaskByTag = async (req, res) => {
    try {
        const shareTag = String(req.body.shareTag || '').trim();
        if (!/^\d{6}$/.test(shareTag)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid 6-digit task code.' });
        }

        const template = await findShareTemplateByTag(shareTag);
        if (!template) return res.status(404).json({ success: false, message: 'Task code not found.' });

        // Adding the same shared task twice just doubles the workload, so say so instead.
        if (await taskModel.exists({ owner: req.userId, shareTag: template.shareTag })) {
            return res.status(409).json({ success: false, message: 'You already have this task.' });
        }

        const importedTask = new taskModel({
            ...getSharePayloadFromTask(template),
            owner: req.userId,
            shareTag: template.shareTag,
        });
        await importedTask.save();
        res.json({ success: true, message: 'Task imported successfully', task: importedTask });
    } catch (error) {
        serverError(res, 'importTaskByTag error', error);
    }
};
