import { MAX_ACTIVITY } from '../models/scheduleModel.js';
import userModel from '../models/userModel.js';
import { notify } from './notify.js';
import { timetableLink } from './appLinks.js';

// A schedule is "live" once at least one person other than the owner can edit it, and a group's timetable
// always is (its members follow it even when the owner is its only admin). Only then are changes logged and
// announced, so a plain copy-share stays quiet.
export const isLive = (schedule) => Boolean(schedule.group) || schedule.collaborators.some((c) => c.role === 'editor');

export const memberIds = (schedule) => [
    (schedule.owner._id ?? schedule.owner).toString(),
    ...schedule.collaborators.map((c) => (c.user._id ?? c.user).toString()),
];

export const describeEntry = (entry) => `"${entry.title}"`;

// `audience` (utils/classChoices.js `changeAudience`) narrows who hears about a change to one class: its
// followers get the usual line, folded into one unread entry per timetable, and members with their own copy
// get a line of their own. Without it everyone on the timetable gets the usual line.
const announceChange = (schedule, actorId, name, summary, { audience } = {}) => async () => {
    const line = {
        sender: actorId,
        type: 'schedule_change',
        title: `"${schedule.title}" was changed`,
        link: timetableLink(schedule._id),
    };
    await notify({
        ...line,
        recipients: audience ? audience.followers : memberIds(schedule),
        message: `${name} ${summary}`,
        collapseLink: true,
    });
    if (audience?.customizers.length) {
        await notify({ ...line, recipients: audience.customizers, message: `${name} ${audience.customSummary}` });
    }
};

const actorName = async (actorId) => (await userModel.findById(actorId).select('name'))?.name || 'Someone';

// Logs a change on the schedule and tells everyone else on it. Call before `schedule.save()`.
// Returns a function to run after the save (it sends the notifications), so a failed save
// never announces something that didn't happen. `options` as for announceChange.
export const recordChange = async (schedule, actorId, summary, options) => {
    if (!isLive(schedule)) return async () => {};
    const name = await actorName(actorId);
    schedule.activity.push({ user: actorId, userName: name, summary: summary.slice(0, 200) });
    if (schedule.activity.length > MAX_ACTIVITY) schedule.activity.splice(0, schedule.activity.length - MAX_ACTIVITY);
    return announceChange(schedule, actorId, name, summary, options);
};

// The same for a change written with one atomic update instead of a load and save, so a concurrent
// edit can't make it fail. `schedule` is a lean read. Returns `push` (merge it into the update; empty
// when the timetable isn't live) and `announce` (run it after the update).
export const recordChangeUpdate = async (schedule, actorId, summary, options) => {
    if (!isLive(schedule)) return { push: {}, announce: async () => {} };
    const name = await actorName(actorId);
    return {
        push: { $push: { activity: { $each: [{ user: actorId, userName: name, summary: summary.slice(0, 200) }], $slice: -MAX_ACTIVITY } } },
        announce: announceChange(schedule, actorId, name, summary, options),
    };
};
