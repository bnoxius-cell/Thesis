import crypto from 'crypto';
import mongoose from 'mongoose';
import groupModel from '../models/groupMode.js';
import groupMessageModel from '../models/groupMessageModel.js';
import taskModel from '../models/taskModel.js';
import scheduleModel from '../models/scheduleModel.js';
import userModel from '../models/userModel.js';
import { notify } from '../utils/notify.js';
import { ensureShareTemplateForTask } from './taskController.js';

const MAX_MESSAGE_LENGTH = 1000;
const INITIAL_MESSAGE_LIMIT = 50;
const POLL_MESSAGE_LIMIT = 100;

// No 0/O/1/I so codes are easy to read out or type from a screenshot.
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const generateJoinCode = () => Array.from(
    crypto.randomBytes(6),
    (byte) => JOIN_CODE_ALPHABET[byte % JOIN_CODE_ALPHABET.length]
).join('');

const createUniqueJoinCode = async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const joinCode = generateJoinCode();
        if (!(await groupModel.exists({ joinCode }))) return joinCode;
    }
    throw new Error('Unable to generate a unique join code.');
};

const isMember = (group, userId) => group.members.some((member) => member.toString() === userId);

// Loads the group and confirms the caller belongs to it. Sends the error response
// itself and returns null when the caller should stop.
const loadGroupForMember = async (req, res) => {
    const { groupId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
        res.status(404).json({ success: false, message: 'Group not found' });
        return null;
    }
    const group = await groupModel.findById(groupId);
    if (!group) {
        res.status(404).json({ success: false, message: 'Group not found' });
        return null;
    }
    if (!isMember(group, req.userId)) {
        res.status(403).json({ success: false, message: 'You are not a member of this group' });
        return null;
    }
    return group;
};

// Adds `addedByMe` to task messages so the chat can show "In your schedule"
// instead of offering the same task again.
const serializeMessages = async (messages, userId) => {
    const tags = [...new Set(messages.filter((m) => m.type === 'task').map((m) => m.task.shareTag))];
    const owned = tags.length
        ? await taskModel.find({ owner: userId, shareTag: { $in: tags } }).select('shareTag')
        : [];
    const ownedTags = new Set(owned.map((task) => task.shareTag));

    const scheduleTokens = messages.filter((m) => m.type === 'schedule').map((m) => `message:${m._id}`);
    const addedTokens = new Set();
    if (scheduleTokens.length) {
        const copies = await scheduleModel.find({ owner: userId, importedFrom: { $in: scheduleTokens } }).select('importedFrom').lean();
        copies.forEach((c) => c.importedFrom.forEach((t) => addedTokens.add(t)));
    }

    return messages.map((message) => {
        const plain = message.toObject();
        if (plain.type === 'task') plain.addedByMe = ownedTags.has(plain.task.shareTag);
        if (plain.type === 'schedule') plain.addedByMe = addedTokens.has(`message:${plain._id}`);
        return plain;
    });
};

export const createGroup = async (req, res) => {
    try {
        const name = req.body.name?.trim();
        const description = req.body.description?.trim() || '';
        if (!name) return res.json({ success: false, message: 'Group name is required.' });

        const newGroup = new groupModel({
            name,
            description,
            joinCode: await createUniqueJoinCode(),
            admin: req.userId,
            members: [req.userId]
        });

        await newGroup.save();
        res.json({ success: true, message: 'Group created successfully', group: newGroup });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const getGroups = async (req, res) => {
    try {
        const groups = await groupModel.find({ members: req.userId })
            .populate('admin', 'name email avatar')
            .populate('members', 'name email avatar');

        // Groups made before join codes existed get one the first time they're listed.
        await Promise.all(groups.filter((group) => !group.joinCode).map(async (group) => {
            group.joinCode = await createUniqueJoinCode();
            await group.save();
        }));

        res.json({ success: true, groups });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const joinGroup = async (req, res) => {
    try {
        const { groupId, joinCode } = req.body;
        const code = String(joinCode || '').trim().toUpperCase();

        let group = null;
        if (code) {
            group = await groupModel.findOne({ joinCode: code });
        } else if (mongoose.Types.ObjectId.isValid(groupId)) {
            group = await groupModel.findById(groupId);
        }

        if (!group) return res.json({ success: false, message: 'Group not found' });
        if (isMember(group, req.userId)) {
            return res.json({ success: false, message: 'Already a member of this group' });
        }

        group.members.push(req.userId);
        await group.save();

        const joiner = await userModel.findById(req.userId).select('name');
        await notify({
            recipients: group.members.filter((m) => m.toString() !== req.userId),
            sender: req.userId,
            type: 'group_member',
            title: group.name,
            message: `${joiner?.name || 'Someone'} joined the group.`,
            link: `/groups?g=${group._id}`,
            group: group._id,
        });
        res.json({ success: true, message: 'Joined group successfully', group });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const leaveGroup = async (req, res) => {
    try {
        const group = await groupModel.findById(req.body.groupId);
        if (!group) return res.json({ success: false, message: 'Group not found' });
        if (group.admin.toString() === req.userId) {
            return res.json({ success: false, message: 'Admin cannot leave the group. Delete it instead.' });
        }
        group.members = group.members.filter(member => member.toString() !== req.userId);
        await group.save();

        // Only the admin hears about it, so a big group doesn't ping everyone.
        const leaver = await userModel.findById(req.userId).select('name');
        await notify({
            recipients: [group.admin],
            sender: req.userId,
            type: 'group_member',
            title: group.name,
            message: `${leaver?.name || 'Someone'} left the group.`,
            link: `/groups?g=${group._id}`,
            group: group._id,
        });
        res.json({ success: true, message: 'Left group successfully' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const deleteGroup = async (req, res) => {
    try {
        const group = await groupModel.findOneAndDelete({ _id: req.params.groupId, admin: req.userId });
        if (!group) return res.json({ success: false, message: 'Group not found or unauthorized' });
        await groupMessageModel.deleteMany({ group: group._id });

        await notify({
            recipients: group.members,
            sender: req.userId,
            type: 'group_member',
            title: group.name,
            message: 'The group was deleted by its admin.',
            link: '/groups',
            group: group._id,
        });
        res.json({ success: true, message: 'Group deleted successfully' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// GET /:groupId/messages          -> most recent messages, oldest first
// GET /:groupId/messages?after=id -> only messages newer than `id` (used for polling)
export const getMessages = async (req, res) => {
    try {
        const group = await loadGroupForMember(req, res);
        if (!group) return;

        const { after } = req.query;
        let messages;
        if (after && mongoose.Types.ObjectId.isValid(after)) {
            messages = await groupMessageModel.find({ group: group._id, _id: { $gt: after } })
                .sort({ _id: 1 })
                .limit(POLL_MESSAGE_LIMIT)
                .populate('sender', 'name avatar');
        } else {
            messages = await groupMessageModel.find({ group: group._id })
                .sort({ _id: -1 })
                .limit(INITIAL_MESSAGE_LIMIT)
                .populate('sender', 'name avatar');
            messages.reverse();
        }

        res.json({ success: true, messages: await serializeMessages(messages, req.userId) });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ success: false, message: 'Could not load messages.' });
    }
};

// POST /:groupId/messages  body: { text } for chat, { taskId } to share one of your tasks,
// or { scheduleId } to share one of your schedules
export const sendMessage = async (req, res) => {
    try {
        const group = await loadGroupForMember(req, res);
        if (!group) return;

        const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
        if (text.length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({ success: false, message: `Messages can be up to ${MAX_MESSAGE_LENGTH} characters.` });
        }

        const messageData = { group: group._id, sender: req.userId, type: 'text', text };

        if (req.body.taskId) {
            if (!mongoose.Types.ObjectId.isValid(req.body.taskId)) {
                return res.status(404).json({ success: false, message: 'Task not found' });
            }
            const task = await taskModel.findOne({ _id: req.body.taskId, owner: req.userId });
            if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

            const template = await ensureShareTemplateForTask(task);
            messageData.type = 'task';
            messageData.task = {
                shareTag: template.shareTag,
                title: task.title,
                course: task.course,
                description: task.description || '',
                dueDate: task.dueDate,
                hours: task.hours,
                difficulty: task.difficulty,
                importance: task.importance,
            };
        } else if (req.body.scheduleId) {
            if (!mongoose.Types.ObjectId.isValid(req.body.scheduleId)) {
                return res.status(404).json({ success: false, message: 'Schedule not found' });
            }
            // Only your own schedules can be posted, so a viewer can't re-share someone else's.
            const schedule = await scheduleModel.findOne({ _id: req.body.scheduleId, owner: req.userId }).populate('owner', 'name');
            if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found' });
            if (!schedule.entries.length) {
                return res.status(400).json({ success: false, message: 'That schedule is empty. Add a class first.' });
            }
            messageData.type = 'schedule';
            messageData.schedule = {
                title: schedule.title,
                ownerName: schedule.owner?.name || '',
                theme: schedule.theme,
                country: schedule.country,
                // Pictures stay out of chat: they are the heavy part and not needed to copy a week.
                entries: schedule.entries.map((e) => ({ ...e.toObject(), _id: undefined, image: '' })),
            };
        } else if (!text) {
            return res.status(400).json({ success: false, message: "Message can't be empty." });
        }

        const message = await groupMessageModel.create(messageData);
        await message.populate('sender', 'name avatar');
        const [serialized] = await serializeMessages([message], req.userId);

        const senderName = message.sender?.name || 'Someone';
        const isTask = message.type === 'task';
        const isSchedule = message.type === 'schedule';
        const preview = text.length > 90 ? `${text.slice(0, 90)}...` : text;
        await notify({
            recipients: group.members,
            sender: req.userId,
            type: isSchedule ? 'group_schedule' : isTask ? 'group_task' : 'group_message',
            title: group.name,
            message: isSchedule
                ? `${senderName} shared a schedule: ${message.schedule.title}`
                : isTask
                    ? `${senderName} shared a task: ${message.task.title}`
                    : `${senderName}: ${preview}`,
            link: `/groups?g=${group._id}`,
            group: group._id,
            // Chat folds into one unread entry per group. A shared task always stands alone.
            collapse: !isTask && !isSchedule,
        });

        res.json({ success: true, message: serialized });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ success: false, message: 'Could not send message.' });
    }
};
