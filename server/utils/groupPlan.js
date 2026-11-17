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

// Rewrites the collaborators to `people` in one pipeline update, which reads each person's current "Count in
// my week" while it writes, so a member turning it on at the same moment isn't lost. It only lands while the
// timetable is still at the version read (`__v`), and bumps it, so of two syncs racing on different reads of
// the group only one lands and the other retries with a newer read. The bump also makes a save from a copy
// loaded before (which writes collaborators by position) fail instead of landing on someone else.
// True when it landed.
const writeCollaborators = async (timetable, people) => {
    const { matchedCount } = await scheduleModel.updateOne({ _id: timetable._id, __v: timetable.__v }, [{
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
    return matchedCount === 1;
};

// One go at putting the timetable in step. True when it is done (nothing to do, or written), false when
// another write got there first. The timetable is read before the group: a group change saved after this
// read runs its own sync, which either finds our write or makes ours miss, so a stale group can't win.
// `loaded` (a group the caller already read) can only skip the work when it already matches: a change saved
// since it was read has its own sync.
const syncOnce = async (groupId, loaded) => {
    const timetable = await scheduleModel.findOne({ group: groupId }).select('collaborators __v').lean();
    if (!timetable) return true;
    if (loaded && samePeople(timetable.collaborators, timetablePeople(loaded))) return true;

    const group = await groupModel.findById(groupId).select('admin admins members').lean();
    if (!group) {
        // The group was deleted while its timetable was being made: nobody should keep it.
        await scheduleModel.deleteOne({ _id: timetable._id, group: groupId });
        return true;
    }
    const people = timetablePeople(group);
    if (samePeople(timetable.collaborators, people)) return true;
    return writeCollaborators(timetable, people);
};

const SYNC_TRIES = 5;

// Puts the group's timetable back in step with the group as it is saved now: every member but the owner on
// it, admins as editors and the rest as viewers, each keeping their own "Count in my week". Runs after every
// membership or admin change, and as a self-heal when the plan loads. Writes nothing when it already matches,
// so the self-heal doesn't make every member's page reload. Pass `group` when it is already loaded.
// It runs after the group change has been saved, so a failure is logged and the next plan load heals it.
export const syncGroupTimetable = async (groupId, { group } = {}) => {
    try {
        for (let attempt = 0; attempt < SYNC_TRIES; attempt += 1) {
            if (await syncOnce(groupId, attempt === 0 ? group : null)) return;
        }
        console.error(`syncGroupTimetable: gave up on group ${groupId} after ${SYNC_TRIES} tries`);
    } catch (error) {
        console.error('syncGroupTimetable error', error);
    }
};
