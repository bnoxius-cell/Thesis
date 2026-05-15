import taskModel from '../models/taskModel.js';
import groupModel from '../models/groupMode.js';

export const createTask = async (req, res) => {
    try {
        const { title, description, group, status, dueDate, priority } = req.body;
        
        const newTask = new taskModel({
            title,
            description,
            owner: req.userId,
            group: group || null,
            status,
            dueDate,
            priority
        });

        await newTask.save();
        res.json({ success: true, message: 'Task created successfully', task: newTask });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const getTasks = async (req, res) => {
    try {
        // Fetch groups to include group-tasks as well as personal tasks
        const userGroups = await groupModel.find({ members: req.userId }).select('_id');
        const groupIds = userGroups.map(g => g._id);

        const tasks = await taskModel.find({
            $or: [ { owner: req.userId }, { group: { $in: groupIds } } ]
        }).populate('group', 'name').sort({ createdAt: -1 });

        res.json({ success: true, tasks });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const updateTask = async (req, res) => {
    try {
        // Updates personal or group tasks that the user owns
        const task = await taskModel.findOneAndUpdate(
            { _id: req.params.taskId, owner: req.userId },
            req.body,
            { new: true }
        );
        if (!task) return res.json({ success: false, message: 'Task not found or unauthorized' });
        res.json({ success: true, message: 'Task updated successfully', task });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const deleteTask = async (req, res) => {
    try {
        const task = await taskModel.findOneAndDelete({ _id: req.params.taskId, owner: req.userId });
        if (!task) return res.json({ success: false, message: 'Task not found or unauthorized' });
        res.json({ success: true, message: 'Task deleted successfully' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};