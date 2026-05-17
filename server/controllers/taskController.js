import taskModel from '../models/taskModel.js';
import mongoose from 'mongoose';

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

const isDuplicateShareTagError = (error) => (
    error?.code === 11000
    && (error?.keyPattern?.shareTag || error?.keyValue?.shareTag)
);

const saveTaskWithShareTagRetry = async (task) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            return await task.save();
        } catch (error) {
            if (!isDuplicateShareTagError(error) || attempt === 2) {
                throw error;
            }
            task.set('shareTag', undefined);
            task.markModified('shareTag');
        }
    }
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

export const createTask = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.userId)) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { payload, error } = getTaskPayload(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const newTask = new taskModel({ ...payload, owner: req.userId });
        await saveTaskWithShareTagRetry(newTask);
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
        await Promise.all(tasks.map((task) => task.shareTag ? task : saveTaskWithShareTagRetry(task)));
        res.json({ success: true, tasks });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateTask = async (req, res) => {
    try {
        const updateFields = getTaskUpdatePayload(req.body);
        const task = await taskModel.findOneAndUpdate(
            { _id: req.params.taskId, owner: req.userId },
            updateFields,
            { new: true, runValidators: true }
        );
        if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
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

// Import a task by its shareTag (copy to current user's tasks)
export const importTaskByTag = async (req, res) => {
    try {
        const shareTag = String(req.body.shareTag || '').trim();
        if (!/^\d{6}$/.test(shareTag)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid 6-digit task code.' });
        }

        const originalTask = await taskModel.findOne({ shareTag });
        if (!originalTask) return res.status(404).json({ success: false, message: 'Task not found' });

        // Create a new task for the current user
        const importedTask = new taskModel({
            title: originalTask.title,
            course: originalTask.course,
            description: originalTask.description,
            dueDate: originalTask.dueDate,
            hours: originalTask.hours,
            difficulty: originalTask.difficulty,
            importance: originalTask.importance,
            owner: req.userId,
            // shareTag will be auto-generated again for the imported copy
        });
        await saveTaskWithShareTagRetry(importedTask);
        res.json({ success: true, message: 'Task imported successfully', task: importedTask });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
