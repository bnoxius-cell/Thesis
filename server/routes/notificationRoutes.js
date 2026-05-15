import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { getNotifications, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications } from '../controllers/notificationController.js';

const notificationRouter = express.Router();

notificationRouter.get('/', userAuth, getNotifications);
notificationRouter.put('/read-all', userAuth, markAllAsRead);
notificationRouter.put('/:notificationId/read', userAuth, markAsRead);
notificationRouter.delete('/clear-all', userAuth, clearAllNotifications);
notificationRouter.delete('/:notificationId', userAuth, deleteNotification);

export default notificationRouter;