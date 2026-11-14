import scheduleModel from '../models/scheduleModel.js';
import taskModel from '../models/taskModel.js';
import reviewerModel from '../models/reviewerModel.js';

// Which Get started steps a student has done. Only `exists` queries, nothing is loaded.
// Every account gets an empty main timetable, so a timetable only counts once it has an entry.
// A reviewer still being made counts: the student did the step.
export const setupSteps = async (userId, user) => {
    const [classes, task, reviewer] = await Promise.all([
        scheduleModel.exists({ $or: [{ owner: userId }, { 'collaborators.user': userId }], 'entries.0': { $exists: true } }),
        taskModel.exists({ owner: userId }),
        reviewerModel.exists({ owner: userId }),
    ]);
    return {
        classes: Boolean(classes),
        task: Boolean(task),
        reviewer: Boolean(reviewer),
        checkin: Boolean(user.lastPSSSubmission || user.lastWHOSubmission),
    };
};
