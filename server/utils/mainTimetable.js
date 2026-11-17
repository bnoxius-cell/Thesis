import scheduleModel, { personalTimetables } from '../models/scheduleModel.js';

const MAIN_SCHEDULE_TITLE = 'My timetable';

// Everyone with schedules has exactly one main. Accounts from before that rule may have several
// and none marked, so the oldest one is promoted the first time it matters.
export const ensureMainSchedule = async (userId) => {
    const owned = await scheduleModel.find(personalTimetables(userId)).select('isMain createdAt').sort({ createdAt: 1, _id: 1 });
    if (!owned.length) return null;
    const mains = owned.filter((s) => s.isMain);
    if (mains.length === 1) return mains[0]._id;
    const keep = mains[0] || owned[0];
    await scheduleModel.updateMany({ ...personalTimetables(userId), _id: { $ne: keep._id } }, { isMain: false });
    await scheduleModel.updateOne({ _id: keep._id }, { isMain: true, countInWorkload: true });
    return keep._id;
};

// The caller's main timetable, created when they have none yet.
export const mainScheduleOrNew = async (userId) => {
    const existingId = await ensureMainSchedule(userId);
    if (existingId) return scheduleModel.findById(existingId);

    try {
        return await scheduleModel.create({ title: MAIN_SCHEDULE_TITLE, owner: userId, isMain: true });
    } catch (error) {
        // Another request made the first timetable at the same moment: use that one.
        if (error.code !== 11000) throw error;
        return scheduleModel.findById(await ensureMainSchedule(userId));
    }
};
