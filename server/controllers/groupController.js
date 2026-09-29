import crypto from 'crypto';
import mongoose from 'mongoose';
import groupModel from '../models/groupMode.js';
import groupMessageModel from '../models/groupMessageModel.js';
import taskModel from '../models/taskModel.js';
import scheduleModel from '../models/scheduleModel.js';
import userModel from '../models/userModel.js';
import { notify } from '../utils/notify.js';
import { ensureShareTemplateForTask } from './taskController.js';
import { containsProfanity } from '../utils/familyFilter.js';
import { isValidPicture } from '../utils/images.js';

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

const MAX_NAME_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 140;

const sameId = (a, b) => String(a) === String(b);
const isMember = (group, userId) => group.members.some((member) => sameId(member, userId));
// The owner is always an admin. Other admins are the ones the owner promoted.
const isOwner = (group, userId) => sameId(group.admin, userId);
const isAdmin = (group, userId) => isOwner(group, userId) || (group.admins || []).some((a) => sameId(a, userId));

// Same shape getGroups returns, so the client can drop an updated group straight into its list.
const populateGroup = (query) => query.populate('admin', 'name avatar').populate('members', 'name avatar');

// Every piece of text a message would put in front of the group, for the family-friendly filter.
const textsToCheck = (messageData) => {
    const texts = [messageData.text];
    if (messageData.task) texts.push(messageData.task.title, messageData.task.course, messageData.task.description);
    if (messageData.schedule) {
        texts.push(messageData.schedule.title);
        (messageData.schedule.entries || []).forEach((e) => texts.push(e.title, e.location));
    }
    return texts;
};

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

        if (name.length > MAX_NAME_LENGTH || description.length > MAX_DESCRIPTION_LENGTH) {
            return res.json({ success: false, message: 'That name or description is too long.' });
        }
        const icon = req.body.icon ?? '';
        if (!isValidPicture(icon)) return res.json({ success: false, message: 'That group picture is too large or not an image.' });

        const newGroup = new groupModel({
            name,
            description,
            icon,
            familyFriendly: req.body.familyFriendly === true,
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
            .populate('admin', 'name avatar')
            .populate('members', 'name avatar');

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
        group.admins = group.admins.filter(member => member.toString() !== req.userId);
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

// PATCH /:groupId  body: any of { name, description, icon, familyFriendly }. Owner and admins.
export const updateGroup = async (req, res) => {
    try {
        const group = await loadGroupForMember(req, res);
        if (!group) return;
        if (!isAdmin(group, req.userId)) {
            return res.status(403).json({ success: false, message: 'Only group admins can change the group.' });
        }

        const { name, description, icon, familyFriendly } = req.body;
        if (name !== undefined) {
            const trimmed = String(name).trim();
            if (!trimmed) return res.status(400).json({ success: false, message: 'Group name is required.' });
            if (trimmed.length > MAX_NAME_LENGTH) return res.status(400).json({ success: false, message: 'That name is too long.' });
            group.name = trimmed;
        }
        if (description !== undefined) {
            const trimmed = String(description).trim();
            if (trimmed.length > MAX_DESCRIPTION_LENGTH) return res.status(400).json({ success: false, message: 'That description is too long.' });
            group.description = trimmed;
        }
        if (icon !== undefined) {
            if (!isValidPicture(icon)) return res.status(400).json({ success: false, message: 'That group picture is too large or not an image.' });
            group.icon = icon;
        }
        if (familyFriendly !== undefined) group.familyFriendly = familyFriendly === true;

        await group.save();
        res.json({ success: true, group: await populateGroup(groupModel.findById(group._id)) });
    } catch (error) {
        console.error('Update group error:', error);
        res.status(500).json({ success: false, message: 'Could not update the group.' });
    }
};

// POST /:groupId/admins  body: { userId }. Owner only. Promotes a member to admin.
export const addAdmin = async (req, res) => {
    try {
        const group = await loadGroupForMember(req, res);
        if (!group) return;
        if (!isOwner(group, req.userId)) {
            return res.status(403).json({ success: false, message: 'Only the group owner can make someone an admin.' });
        }
        const { userId } = req.body;
        if (!userId || !isMember(group, userId)) {
            return res.status(404).json({ success: false, message: 'That person is not in this group.' });
        }
        if (!isAdmin(group, userId)) {
            group.admins.push(userId);
            await group.save();
            const owner = await userModel.findById(req.userId).select('name');
            await notify({
                recipients: [userId],
                sender: req.userId,
                type: 'group_member',
                title: group.name,
                message: `${owner?.name || 'The owner'} made you an admin.`,
                link: `/groups?g=${group._id}`,
                group: group._id,
            });
        }
        res.json({ success: true, group: await populateGroup(groupModel.findById(group._id)) });
    } catch (error) {
        console.error('Add admin error:', error);
        res.status(500).json({ success: false, message: 'Could not change that role.' });
    }
};

// DELETE /:groupId/admins/:userId  Owner only. Back to a regular member.
export const removeAdmin = async (req, res) => {
    try {
        const group = await loadGroupForMember(req, res);
        if (!group) return;
        if (!isOwner(group, req.userId)) {
            return res.status(403).json({ success: false, message: 'Only the group owner can remove an admin.' });
        }
        group.admins = group.admins.filter((a) => !sameId(a, req.params.userId));
        await group.save();
        res.json({ success: true, group: await populateGroup(groupModel.findById(group._id)) });
    } catch (error) {
        console.error('Remove admin error:', error);
        res.status(500).json({ success: false, message: 'Could not change that role.' });
    }
};

// DELETE /:groupId/members/:userId  Owner and admins. Admins can only remove regular members.
export const removeMember = async (req, res) => {
    try {
        const group = await loadGroupForMember(req, res);
        if (!group) return;
        const { userId } = req.params;

        if (!isAdmin(group, req.userId)) {
            return res.status(403).json({ success: false, message: 'Only group admins can remove members.' });
        }
        if (!isMember(group, userId)) {
            return res.status(404).json({ success: false, message: 'That person is not in this group.' });
        }
        if (isOwner(group, userId)) {
            return res.status(403).json({ success: false, message: "The owner can't be removed." });
        }
        if (isAdmin(group, userId) && !isOwner(group, req.userId)) {
            return res.status(403).json({ success: false, message: 'Only the owner can remove another admin.' });
        }

        group.members = group.members.filter((m) => !sameId(m, userId));
        group.admins = group.admins.filter((a) => !sameId(a, userId));
        await group.save();

        await notify({
            recipients: [userId],
            sender: req.userId,
            type: 'group_member',
            title: group.name,
            message: 'You were removed from the group.',
            link: '/groups',
            group: group._id,
        });
        res.json({ success: true, group: await populateGroup(groupModel.findById(group._id)) });
    } catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({ success: false, message: 'Could not remove that member.' });
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

        if (group.familyFriendly && textsToCheck(messageData).some(containsProfanity)) {
            return res.status(400).json({
                success: false,
                code: 'family_filter',
                message: 'This group is set to family-friendly, so that message was not sent. Try rewording it.',
            });
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
