import groupTaskModel from '../models/groupTaskModel.js';
import scheduleModel from '../models/scheduleModel.js';
import { loadGroupForMember } from './groupController.js';
import { getTaskPayload } from './taskController.js';
import { summarizeFor } from './scheduleController.js';
import {
    planRole, bumpPlan, allowPlanWrite, createGroupTimetable, syncGroupTimetable,
} from '../utils/groupPlan.js';
import { readTaskEdit, editGroupTask, isPlainObject } from '../utils/groupTaskEdit.js';
import { seen, present } from '../utils/presence.js';
import { isMember, sameId } from '../utils/groupRoles.js';
import { containsProfanity } from '../utils/familyFilter.js';
import { isId, serverError } from '../utils/httpErrors.js';
import { notify } from '../utils/notify.js';
import { groupLink } from '../utils/appLinks.js';

const MAX_GROUP_TASKS = 200;
const TASK_NOT_FOUND = { success: false, message: 'Task not found' };
const FAMILY_FILTER = {
    success: false,
    code: 'family_filter',
    message: 'This group is set to family-friendly, so that task was not saved. Try rewording it.',
};

// Who did what, by name, next to each task.
const PEOPLE = ['createdBy', 'updatedBy', 'completedBy'].map((path) => ({ path, select: 'name' }));

const breaksFamilyFilter = (group, fields) => group.familyFriendly
    && [fields.title, fields.course, fields.description].some(containsProfanity);

// Like loadGroupForMember, plus the caller must be allowed to change the group's plan and still
// be under the write limit. Sends the error response itself and returns null when the caller should stop.
const loadGroupForEditor = async (req, res) => {
    const group = await loadGroupForMember(req, res);
    if (!group) return null;
    if (planRole(group, req.userId) !== 'editor') {
        res.status(403).json({ success: false, message: "Only admins can change this group's plan." });
        return null;
    }
    if (!allowPlanWrite(req.userId)) {
        res.status(429).json({ success: false, message: 'Slow down a little.' });
        return null;
    }
    return group;
};

// What the plan shows about the group's timetable; the entries themselves load on the timetable's own page.
const TIMETABLE_SUMMARY_FIELDS = 'title theme owner group isMain countInWorkload collaborators shareCode entries._id updatedAt';

// GET /:groupId/plan  Members only. The whole group plan: its tasks and a summary of its timetable
// (null until an admin makes one).
export const getPlan = async (req, res) => {
    try {
        const group = await loadGroupForMember(req, res);
        if (!group) return;
        const serverTime = new Date();
        await syncGroupTimetable(group._id, { group });
        const [tasks, timetable] = await Promise.all([
            groupTaskModel.find({ group: group._id }).sort({ dueDate: 1 }).populate(PEOPLE),
            scheduleModel.findOne({ group: group._id }).select(TIMETABLE_SUMMARY_FIELDS).populate('group', 'name'),
        ]);
        res.json({
            success: true,
            serverTime: serverTime.toISOString(),
            role: planRole(group, req.userId),
            tasks,
            timetable: timetable && summarizeFor(timetable, req.userId),
        });
    } catch (error) {
        serverError(res, 'getPlan error', error);
    }
};

// GET /:groupId/plan/stamp?editing=<taskId>  Members only. Polled while the plan is open: when the
// plan last changed, and who else has it open. Records the caller as present.
export const getPlanStamp = async (req, res) => {
    try {
        const group = await loadGroupForMember(req, res);
        if (!group) return;

        const { editing } = req.query;
        const editingTask = isId(editing) && await groupTaskModel.exists({ _id: editing, group: group._id });
        seen(group._id, req.userId, editingTask ? editing : null);

        // Someone removed in the last few seconds may still be in the map; only current members show.
        const presence = present(group._id)
            .filter(({ userId }) => !sameId(userId, req.userId) && isMember(group, userId));
        const timetable = await scheduleModel.findOne({ group: group._id }).select('updatedAt').lean();
        res.json({ success: true, planAt: group.planAt, timetableAt: timetable?.updatedAt ?? null, presence });
    } catch (error) {
        serverError(res, 'getPlanStamp error', error);
    }
};

// POST /:groupId/tasks  Owner and admins. Adds a task to the group plan.
// Two creates at the same moment at 199 tasks can both pass the count and make 201; that's fine.
export const createGroupTask = async (req, res) => {
    try {
        const group = await loadGroupForEditor(req, res);
        if (!group) return;

        const { payload, error } = getTaskPayload(isPlainObject(req.body) ? req.body : {});
        if (error) return res.status(400).json({ success: false, message: error });
        if (breaksFamilyFilter(group, payload)) return res.status(400).json(FAMILY_FILTER);
        if (await groupTaskModel.countDocuments({ group: group._id }) >= MAX_GROUP_TASKS) {
            return res.status(400).json({ success: false, message: `A group can have up to ${MAX_GROUP_TASKS} tasks.` });
        }

        const task = await groupTaskModel.create({ ...payload, group: group._id, createdBy: req.userId, updatedBy: req.userId });
        await bumpPlan(group._id);
        await task.populate(PEOPLE);

        await notify({
            recipients: group.members,
            sender: req.userId,
            type: 'group_task',
            title: group.name,
            message: `${task.createdBy?.name || 'Someone'} added a group task: ${task.title}`,
            link: groupLink(group._id),
            group: group._id,
        });
        res.status(201).json({ success: true, task });
    } catch (error) {
        serverError(res, 'createGroupTask error', error);
    }
};

// PATCH /:groupId/tasks/:taskId  body: { changes, expected }. Owner and admins.
// 200 { task } when saved (or already changed that way by someone else), 409 { task, conflicts }
// when someone else changed the same field to something else first.
export const updateGroupTask = async (req, res) => {
    try {
        const group = await loadGroupForEditor(req, res);
        if (!group) return;
        if (!isId(req.params.taskId)) return res.status(404).json(TASK_NOT_FOUND);

        const { fields, expected, error } = readTaskEdit(req.body);
        if (error) return res.status(400).json({ success: false, message: error });
        if (breaksFamilyFilter(group, fields)) return res.status(400).json(FAMILY_FILTER);

        const result = await editGroupTask({ groupId: group._id, taskId: req.params.taskId, fields, expected, userId: req.userId });
        if (result.status === 'gone') return res.status(404).json(TASK_NOT_FOUND);
        if (result.status === 'saved') await bumpPlan(group._id);

        const task = await result.task.populate(PEOPLE);
        if (result.status === 'conflict') {
            return res.status(409).json({
                success: false,
                message: `${task.updatedBy?.name || 'Someone'} changed this task first. Check the new details and try again.`,
                task,
                conflicts: result.conflicts,
            });
        }
        res.json({ success: true, task });
    } catch (error) {
        serverError(res, 'updateGroupTask error', error);
    }
};

// POST /:groupId/timetable  Owner and admins. Makes the group's timetable, owned by the group owner.
export const createTimetable = async (req, res) => {
    try {
        const group = await loadGroupForEditor(req, res);
        if (!group) return;
        const timetable = await createGroupTimetable(group);
        if (!timetable) return res.status(409).json({ success: false, message: 'This group already has a timetable.' });
        await timetable.populate('group', 'name');
        res.status(201).json({ success: true, timetable: summarizeFor(timetable, req.userId) });
    } catch (error) {
        serverError(res, 'createTimetable error', error);
    }
};

// DELETE /:groupId/tasks/:taskId  Owner and admins.
export const deleteGroupTask = async (req, res) => {
    try {
        const group = await loadGroupForEditor(req, res);
        if (!group) return;
        if (!isId(req.params.taskId)) return res.status(404).json(TASK_NOT_FOUND);

        const task = await groupTaskModel.findOneAndDelete({ _id: req.params.taskId, group: group._id });
        if (!task) return res.status(404).json(TASK_NOT_FOUND);
        await bumpPlan(group._id);
        res.json({ success: true });
    } catch (error) {
        serverError(res, 'deleteGroupTask error', error);
    }
};
