import { MAX_ACTIVITY } from '../models/scheduleModel.js';
import userModel from '../models/userModel.js';
import { notify } from './notify.js';
import { timetableLink } from './appLinks.js';

// A schedule is "live" once at least one person other than the owner can edit it. Only then
// are changes logged and announced, so a plain copy-share stays quiet.
export const isLive = (schedule) => schedule.collaborators.some((c) => c.role === 'editor');

const memberIds = (schedule) => [
    (schedule.owner._id ?? schedule.owner).toString(),
    ...schedule.collaborators.map((c) => (c.user._id ?? c.user).toString()),
];

export const describeEntry = (entry) => `"${entry.title}"`;

const announceChange = (schedule, actorId, name, summary) => () => notify({
    recipients: memberIds(schedule),
    sender: actorId,
    type: 'schedule_change',
    title: `"${schedule.title}" was changed`,
    message: `${name} ${summary}`,
    link: timetableLink(schedule._id),
    collapseLink: true,
});

const actorName = async (actorId) => (await userModel.findById(actorId).select('name'))?.name || 'Someone';

// Logs a change on the schedule and tells everyone else on it. Call before `schedule.save()`.
// Returns a function to run after the save (it sends the notifications), so a failed save
// never announces something that didn't happen.
export const recordChange = async (schedule, actorId, summary) => {
    if (!isLive(schedule)) return async () => {};
    const name = await actorName(actorId);
    schedule.activity.push({ user: actorId, userName: name, summary: summary.slice(0, 200) });
    if (schedule.activity.length > MAX_ACTIVITY) schedule.activity.splice(0, schedule.activity.length - MAX_ACTIVITY);
    return announceChange(schedule, actorId, name, summary);
};

// The same for a change written with one atomic update instead of a load and save, so a concurrent
// edit can't make it fail. `schedule` is a lean read. Returns `push` (merge it into the update; empty
// when the timetable isn't live) and `announce` (run it after the update).
export const recordChangeUpdate = async (schedule, actorId, summary) => {
    if (!isLive(schedule)) return { push: {}, announce: async () => {} };
    const name = await actorName(actorId);
    return {
        push: { $push: { activity: { $each: [{ user: actorId, userName: name, summary: summary.slice(0, 200) }], $slice: -MAX_ACTIVITY } } },
        announce: announceChange(schedule, actorId, name, summary),
    };
};
