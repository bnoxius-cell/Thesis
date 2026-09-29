import mongoose from 'mongoose';
import notificationModel from '../models/notificationModel.js';
import pushSubscriptionModel from '../models/pushSubscriptionModel.js';
import userModel from '../models/userModel.js';
import { getPublicKey } from '../utils/push.js';

const LIST_LIMIT = 100;
const GROUP_LEVELS = ['all', 'tasks', 'muted'];
const LEAD_HOURS = [3, 24, 48];
const BOOLEAN_PREFS = ['taskReminders', 'friendActivity', 'scheduleShares', 'groupMessages', 'groupTasks', 'groupMembers'];

const serializePrefs = (user) => {
    const prefs = user.notificationPrefs || {};
    return {
        taskReminders: prefs.taskReminders !== false,
        reminderLeadHours: prefs.reminderLeadHours || 24,
        friendActivity: prefs.friendActivity !== false,
        scheduleShares: prefs.scheduleShares !== false,
        groupMessages: prefs.groupMessages !== false,
        groupTasks: prefs.groupTasks !== false,
        groupMembers: prefs.groupMembers !== false,
        groupOverrides: (prefs.groupOverrides || []).map((o) => ({ group: o.group.toString(), level: o.level })),
    };
};

export const getNotifications = async (req, res) => {
    try {
        const [notifications, unreadCount] = await Promise.all([
            notificationModel.find({ recipient: req.userId })
                .populate('sender', 'name avatar')
                .sort({ activityAt: -1 })
                .limit(LIST_LIMIT),
            notificationModel.countDocuments({ recipient: req.userId, isRead: false }),
        ]);
        res.json({ success: true, notifications, unreadCount });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const markAsRead = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.notificationId)) {
            return res.json({ success: false, message: 'Notification not found' });
        }
        const notification = await notificationModel.findOneAndUpdate(
            { _id: req.params.notificationId, recipient: req.userId },
            { isRead: true },
            { new: true }
        );
        if (!notification) return res.json({ success: false, message: 'Notification not found' });
        res.json({ success: true, message: 'Marked as read', notification });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const markAllAsRead = async (req, res) => {
    try {
        await notificationModel.updateMany({ recipient: req.userId, isRead: false }, { isRead: true });
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const deleteNotification = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.notificationId)) {
            return res.json({ success: false, message: 'Notification not found' });
        }
        const notification = await notificationModel.findOneAndDelete({ _id: req.params.notificationId, recipient: req.userId });
        if (!notification) return res.json({ success: false, message: 'Notification not found' });
        res.json({ success: true, message: 'Notification deleted' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const clearAllNotifications = async (req, res) => {
    try {
        await notificationModel.deleteMany({ recipient: req.userId });
        res.json({ success: true, message: 'All notifications cleared' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// GET /api/notifications/preferences
export const getPreferences = async (req, res) => {
    try {
        const user = await userModel.findById(req.userId).select('notificationPrefs');
        if (!user) return res.json({ success: false, message: 'User not found.' });
        res.json({ success: true, preferences: serializePrefs(user) });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// PUT /api/notifications/preferences  (send only the fields that changed)
export const updatePreferences = async (req, res) => {
    try {
        const body = req.body || {};
        const $set = {};

        for (const key of BOOLEAN_PREFS) {
            if (body[key] === undefined) continue;
            if (typeof body[key] !== 'boolean') return res.json({ success: false, message: `${key} must be on or off.` });
            $set[`notificationPrefs.${key}`] = body[key];
        }

        if (body.reminderLeadHours !== undefined) {
            if (!LEAD_HOURS.includes(body.reminderLeadHours)) {
                return res.json({ success: false, message: 'Pick 3 hours, 1 day or 2 days for reminders.' });
            }
            $set['notificationPrefs.reminderLeadHours'] = body.reminderLeadHours;
        }

        if (body.groupOverrides !== undefined) {
            if (!Array.isArray(body.groupOverrides) || body.groupOverrides.length > 200) {
                return res.json({ success: false, message: 'Invalid group settings.' });
            }
            const seen = new Set();
            const overrides = [];
            for (const item of body.groupOverrides) {
                if (!mongoose.Types.ObjectId.isValid(item?.group) || !GROUP_LEVELS.includes(item?.level)) {
                    return res.json({ success: false, message: 'Invalid group settings.' });
                }
                // Keeping "all" would just be the default, so don't store it.
                if (item.level === 'all' || seen.has(String(item.group))) continue;
                seen.add(String(item.group));
                overrides.push({ group: item.group, level: item.level });
            }
            $set['notificationPrefs.groupOverrides'] = overrides;
        }

        const user = await userModel.findByIdAndUpdate(req.userId, { $set }, { returnDocument: 'after', runValidators: true })
            .select('notificationPrefs');
        if (!user) return res.json({ success: false, message: 'User not found.' });
        res.json({ success: true, preferences: serializePrefs(user) });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// GET /api/notifications/push/key  -> the public VAPID key the browser needs to subscribe
export const getPushKey = (req, res) => {
    const publicKey = getPublicKey();
    res.json({ success: true, enabled: Boolean(publicKey), publicKey });
};

// POST /api/notifications/push/subscribe  { subscription: PushSubscription.toJSON() }
export const subscribePush = async (req, res) => {
    try {
        const { endpoint, keys } = req.body?.subscription || {};
        if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || !keys?.p256dh || !keys?.auth) {
            return res.json({ success: false, message: 'Invalid push subscription.' });
        }
        // Upsert by endpoint: if this browser was last used by someone else, it now
        // belongs to whoever is logged in.
        await pushSubscriptionModel.findOneAndUpdate(
            { endpoint },
            { user: req.userId, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, userAgent: String(req.get('user-agent') || '').slice(0, 300) },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
        res.json({ success: true, message: 'Device notifications are on.' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// POST /api/notifications/push/unsubscribe  { endpoint }
export const unsubscribePush = async (req, res) => {
    try {
        const { endpoint } = req.body || {};
        if (typeof endpoint === 'string') {
            await pushSubscriptionModel.deleteOne({ endpoint, user: req.userId });
        }
        res.json({ success: true, message: 'Device notifications are off.' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};
