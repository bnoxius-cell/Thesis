import taskModel from '../models/taskModel.js';
import taskShareModel from '../models/taskShareModel.js';
import mongoose from 'mongoose';

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

const getTaskPayload = (body) => {
    const title = body.title?.trim();
    const course = body.course?.trim();
    const description = body.description?.trim() || '';
    const dueDate = body.dueDate ? new Date(body.dueDate) : null;
    const hours = Number(body.hours ?? 3);
    const difficulty = Number(body.difficulty ?? 3);
    const importance = Number(body.importance ?? 3);

    if (!title || !course || !body.dueDate) {
        return { error: 'Title, course, and due date are required.' };
    }

    if (!Number.isFinite(dueDate?.getTime())) {
        return { error: 'Please provide a valid due date.' };
    }

    if (!Number.isFinite(hours) || hours < 0.5) {
        return { error: 'Estimated hours must be at least 0.5.' };
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

const ensureShareTemplateForTask = async (task) => {
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

const getTaskUpdatePayload = (body) => {
    const allowedFields = {};

    if (body.title !== undefined) allowedFields.title = body.title.trim();
    if (body.course !== undefined) allowedFields.course = body.course.trim();
    if (body.description !== undefined) allowedFields.description = body.description.trim();
    if (body.dueDate !== undefined) allowedFields.dueDate = new Date(body.dueDate);
    if (body.hours !== undefined) allowedFields.hours = Number(body.hours);
    if (body.difficulty !== undefined) allowedFields.difficulty = Number(body.difficulty);
    if (body.importance !== undefined) allowedFields.importance = Number(body.importance);
    if (body.isCompleted !== undefined) allowedFields.isCompleted = Boolean(body.isCompleted);

    return allowedFields;
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
        res.status(500).json({ success: false, message: error.message });
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

        res.json({
            success: true,
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
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateTask = async (req, res) => {
    try {
        const updateFields = getTaskUpdatePayload(req.body);
        const task = await taskModel.findOne({ _id: req.params.taskId, owner: req.userId });
        if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

        Object.assign(task, updateFields);

        const detailFields = ['title', 'course', 'description', 'dueDate', 'hours', 'difficulty', 'importance'];
        const detailsChanged = detailFields.some((field) => updateFields[field] !== undefined);
        if (detailsChanged) {
            const template = await createShareTemplate(getSharePayloadFromTask(task), req.userId);
            task.shareTag = template.shareTag;
        }

        await task.save();
        res.json({ success: true, task });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteTask = async (req, res) => {
    try {
        const task = await taskModel.findOneAndDelete({ _id: req.params.taskId, owner: req.userId });
        if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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

        const importedTask = new taskModel({
            ...getSharePayloadFromTask(template),
            owner: req.userId,
            shareTag: template.shareTag,
        });
        await importedTask.save();
        res.json({ success: true, message: 'Task imported successfully', task: importedTask });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
