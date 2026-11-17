import groupModel from '../models/groupMode.js';
import { isMember, isAdmin } from './groupRoles.js';
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
