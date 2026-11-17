import mongoose from 'mongoose';
import groupModel from '../models/groupMode.js';
import scheduleModel from '../models/scheduleModel.js';
import { isMember, isAdmin, isOwner, sameId } from './groupRoles.js';
import { hit } from './rateLimit.js';

// Who may change the group's own copy of its plan (owner, 2026-11-17: admins only).
//   'editor'  the owner and admins
//   'viewer'  other members: see everything, change nothing in the group's copy
//   null      not in the group
export const planRole = (group, userId) => {
    if (!isMember(group, userId)) return null;
    return isAdmin(group, userId) ? 'editor' : 'viewer';
};

// Marks the plan as changed, so every member's stamp poll picks it up. It runs after the write has
// been saved, so a failure here is logged and not sent to the client as a failed save.
export const bumpPlan = async (groupId) => {
    try {
        await groupModel.updateOne({ _id: groupId }, { $set: { planAt: new Date() } });
    } catch (error) {
        console.error('bumpPlan error', error);
    }
};

const PLAN_WRITE_RATE = { limit: 60, windowMs: 60 * 1000 };

// Counts one group-plan write for this user. False once they have made 60 in a minute.
export const allowPlanWrite = (userId) => hit(`group-plan:${userId}`, PLAN_WRITE_RATE).ok;

const asId = (id) => new mongoose.Types.ObjectId(String(id));

// Who belongs on the group's timetable besides its owner (the group owner), with their plan role.
const timetablePeople = (group) => group.members
    .filter((member) => !isOwner(group, member))
    .map((member) => ({ user: asId(member), role: planRole(group, member) }));

const samePeople = (collaborators, people) => collaborators.length === people.length
    && people.every((p) => collaborators.some((c) => sameId(c.user, p.user) && c.role === p.role));

// Makes the group's timetable: owned by the group owner, everyone else on it with their plan role, not
// counted in anyone's week until they choose. Returns null when the group already has one.
export const createGroupTimetable = async (group) => {
    try {
        return await scheduleModel.create({
            title: group.name,
            owner: group.admin,
            group: group._id,
            isMain: false,
            countInWorkload: false,
            collaborators: timetablePeople(group),
        });
    } catch (error) {
        if (error.code === 11000) return null;
        throw error;
    }
};

// Puts the group's timetable back in step with the group as it is saved now: every member but the owner on
// it, admins as editors and the rest as viewers, each keeping their own "Count in my week". Runs after every
// membership or admin change, and as a self-heal when the plan loads. Writes nothing when it already matches,
// so the self-heal doesn't make every member's page reload.
export const syncGroupTimetable = async (groupId) => {
    const [group, timetable] = await Promise.all([
        groupModel.findById(groupId).select('admin admins members').lean(),
        scheduleModel.findOne({ group: groupId }).select('collaborators').lean(),
    ]);
    if (!group || !timetable) return;
    const people = timetablePeople(group);
    if (samePeople(timetable.collaborators, people)) return;

    // One pipeline update reads each person's current "Count in my week" while it writes, so a member
    // turning it on at the same moment isn't lost. The list is rebuilt, so the version goes up and a save from
    // a copy loaded before (which writes collaborators by position) fails instead of landing on someone else.
    await scheduleModel.updateOne({ _id: timetable._id }, [{
        $set: {
            collaborators: {
                $map: {
                    input: { $literal: people },
                    as: 'person',
                    in: {
                        user: '$$person.user',
                        role: '$$person.role',
                        countInWorkload: {
                            $in: ['$$person.user', {
                                $map: {
                                    input: { $filter: { input: '$collaborators', as: 'c', cond: { $eq: ['$$c.countInWorkload', true] } } },
                                    as: 'c',
                                    in: '$$c.user',
                                },
                            }],
                        },
                    },
                },
            },
            __v: { $add: [{ $ifNull: ['$__v', 0] }, 1] },
        },
    }], { updatePipeline: true });
};
