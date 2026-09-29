import notificationModel from '../models/notificationModel.js';
import userModel from '../models/userModel.js';
import { sendPushToUser } from './push.js';

// Which preference switch controls each notification type. 'system' has none and is
// always delivered.
const PREF_BY_TYPE = {
    friend_request: 'friendActivity',
    friend_accepted: 'friendActivity',
    schedule_share: 'scheduleShares',
    task_reminder: 'taskReminders',
    group_message: 'groupMessages',
    group_task: 'groupTasks',
    group_member: 'groupMembers',
    group_invite: 'groupMembers',
};

// Should a user with these prefs hear about this? Missing values count as "on".
export const allowsNotification = (prefs, type, groupId) => {
    const key = PREF_BY_TYPE[type];
    if (key && prefs?.[key] === false) return false;

    if (groupId) {
        const override = prefs?.groupOverrides?.find((o) => o.group.toString() === groupId.toString());
        if (override?.level === 'muted') return false;
        if (override?.level === 'tasks' && type !== 'group_task') return false;
    }
    return true;
};

// Creates an in-app notification for each recipient who wants it, then sends a push
// to their devices. Returns the notifications that were created or updated.
//
//   recipients  user ids (the sender is skipped automatically)
//   collapse    for chat: fold into the recipient's existing unread notification for
//               this group instead of stacking one per message
//   dedupeKey   skip recipients who already got this exact event
export const notify = async (options) => {
    // The action that triggered this (a chat message, a friend request) already
    // succeeded, so a notification problem must never turn it into an error.
    try {
        return await deliver(options);
    } catch (error) {
        console.error('Notify failed:', error.message);
        return [];
    }
};

const deliver = async ({ recipients, sender, type, title = '', message, link = '', group = null, dedupeKey, collapse = false }) => {
    const ids = [...new Set(recipients.map(String))].filter((id) => id !== String(sender || ''));
    if (!ids.length) return [];

    const users = await userModel.find({ _id: { $in: ids } }).select('notificationPrefs');
    const wanted = users.filter((user) => allowsNotification(user.notificationPrefs, type, group));

    const delivered = [];
    for (const user of wanted) {
        const recipient = user._id;
        try {
            let doc = null;

            if (collapse && group) {
                doc = await notificationModel.findOne({ recipient, type, group, isRead: false });
                if (doc) {
                    doc.count += 1;
                    doc.message = `${doc.count} new messages`;
                    doc.title = title;
                    doc.sender = sender;
                    doc.activityAt = new Date();
                    await doc.save();
                }
            }

            if (!doc) {
                doc = await notificationModel.create({
                    recipient, sender, type, title, message, link, group,
                    ...(dedupeKey ? { dedupeKey } : {}),
                });
            }
            delivered.push(doc);

            // Not awaited: a slow push service shouldn't hold up the request.
            sendPushToUser(recipient, {
                title: title || 'StressCare',
                body: message,
                url: link || '/notifications',
                tag: group ? `group-${group}` : `${type}-${doc._id}`,
            });
        } catch (error) {
            // A duplicate dedupeKey means they already got this one. Anything else is
            // logged, and the remaining recipients still get theirs.
            if (error.code !== 11000) console.error('Notify failed:', error.message);
        }
    }
    return delivered;
};
