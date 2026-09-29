import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = [
    'friend_request',
    'friend_accepted',
    'group_invite',
    'group_message',
    'group_task',
    'group_member',
    'task_reminder',
    'schedule_share',
    'system',
];

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    type: {
        type: String,
        enum: NOTIFICATION_TYPES,
        required: true
    },
    title: {
        type: String,
        default: ''
    },
    message: {
        type: String,
        required: true
    },
    // In-app route to open when the notification is clicked, e.g. /groups?g=<id>
    link: {
        type: String,
        default: ''
    },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'group',
        default: null
    },
    // Chat notifications collapse into one entry per group while unread; this is how
    // many messages it stands for.
    count: {
        type: Number,
        default: 1
    },
    // Stops the same event (a task reminder, say) from being created twice.
    dedupeKey: {
        type: String
    },
    // Bumped when a collapsed notification gets new activity, so it floats back to the top.
    activityAt: {
        type: Date,
        default: Date.now
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

notificationSchema.index({ recipient: 1, activityAt: -1 });
notificationSchema.index(
    { recipient: 1, dedupeKey: 1 },
    { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } }
);

export default mongoose.models.notification || mongoose.model('notification', notificationSchema);
