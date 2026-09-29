import express from 'express';
import userAuth from '../middleware/userAuth.js';
import {
    getNotifications, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications,
    getPreferences, updatePreferences, getPushKey, subscribePush, unsubscribePush,
} from '../controllers/notificationController.js';

const notificationRouter = express.Router();

notificationRouter.get('/', userAuth, getNotifications);
notificationRouter.get('/preferences', userAuth, getPreferences);
notificationRouter.put('/preferences', userAuth, updatePreferences);
notificationRouter.get('/push/key', userAuth, getPushKey);
notificationRouter.post('/push/subscribe', userAuth, subscribePush);
notificationRouter.post('/push/unsubscribe', userAuth, unsubscribePush);
notificationRouter.put('/read-all', userAuth, markAllAsRead);
notificationRouter.put('/:notificationId/read', userAuth, markAsRead);
notificationRouter.delete('/clear-all', userAuth, clearAllNotifications);
notificationRouter.delete('/:notificationId', userAuth, deleteNotification);

export default notificationRouter;
