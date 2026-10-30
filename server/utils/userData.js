import subjectModel from '../models/subjectModel.js';
import taskModel from '../models/taskModel.js';
import taskShareModel from '../models/taskShareModel.js';
import reviewerModel from '../models/reviewerModel.js';
import reviewerAttemptModel from '../models/reviewerAttemptModel.js';
import aiRequestModel from '../models/aiRequestModel.js';
import scheduleModel from '../models/scheduleModel.js';
import groupModel from '../models/groupMode.js';
import groupMessageModel from '../models/groupMessageModel.js';
import notificationModel from '../models/notificationModel.js';
import pushSubscriptionModel from '../models/pushSubscriptionModel.js';
import friendModel from '../models/Friend.js';
import userModel from '../models/userModel.js';
import { PSSResponse, WHOResponse } from '../models/Survey.js';

// Every place a student's id is stored. `field` is the path to the id inside the model
// (`collaborators.user` is inside an array of sub-documents).
//   how: 'delete'  the document belongs to this student alone, so it is deleted with them.
//   how: 'pending' the id sits in something other people use (a shared group, a schedule,
//                  a friend's list). Account deletion (P-1) decides what happens to those:
//                  remove the id, hand a group over, and so on. deleteUserData skips them.
// A test checks that every `ref: 'user'` path in server/models/ is listed here, so a new
// collection can't be forgotten. Add the entry in the same change as the model.
export const USER_DATA = [
    { model: subjectModel, field: 'owner', how: 'delete' },
    { model: taskModel, field: 'owner', how: 'delete' },
    { model: reviewerModel, field: 'owner', how: 'delete' },
    { model: reviewerAttemptModel, field: 'user', how: 'delete' },
    { model: aiRequestModel, field: 'user', how: 'delete' },
    { model: PSSResponse, field: 'user', how: 'delete' },
    { model: WHOResponse, field: 'user', how: 'delete' },
    { model: pushSubscriptionModel, field: 'user', how: 'delete' },
    { model: notificationModel, field: 'recipient', how: 'delete' },
    { model: friendModel, field: 'user', how: 'delete' },

    { model: notificationModel, field: 'sender', how: 'pending' },
    { model: friendModel, field: 'friend', how: 'pending' },
    { model: taskShareModel, field: 'createdBy', how: 'pending' },
    { model: groupMessageModel, field: 'sender', how: 'pending' },
    { model: groupModel, field: 'admin', how: 'pending' },
    { model: groupModel, field: 'admins', how: 'pending' },
    { model: groupModel, field: 'members', how: 'pending' },
    { model: groupModel, field: 'pinned.by', how: 'pending' },
    { model: groupModel, field: 'recentMessages.sender', how: 'pending' },
    { model: scheduleModel, field: 'owner', how: 'pending' },
    { model: scheduleModel, field: 'collaborators.user', how: 'pending' },
    { model: scheduleModel, field: 'activity.user', how: 'pending' },
    { model: userModel, field: 'friends', how: 'pending' },
];

export const deleteUserData = async (userId) => {
    const owned = USER_DATA.filter((entry) => entry.how === 'delete');
    await Promise.all(owned.map(({ model, field }) => model.deleteMany({ [field]: userId })));
};
