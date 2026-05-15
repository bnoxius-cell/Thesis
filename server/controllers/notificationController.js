import notificationModel from '../models/notificationModel.js';

export const getNotifications = async (req, res) => {
    try {
        const notifications = await notificationModel.find({ recipient: req.userId })
            .populate('sender', 'name avatar')
            .sort({ createdAt: -1 });
        res.json({ success: true, notifications });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export const markAsRead = async (req, res) => {
    try {
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