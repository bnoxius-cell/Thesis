import express from 'express';
import userAuth from '../middleware/userAuth.js';
import {
    createGroup, getGroups, joinGroup, leaveGroup, deleteGroup, getMessages, sendMessage,
    updateGroup, addAdmin, removeAdmin, removeMember, getUpcoming, setReaction, deleteMessage,
    saveFromMessage,
} from '../controllers/groupController.js';
import {
    getPlan, getPlanStamp, createGroupTask, updateGroupTask, deleteGroupTask, createTimetable,
} from '../controllers/groupPlanController.js';

const groupRouter = express.Router();

groupRouter.post('/', userAuth, createGroup);
groupRouter.get('/', userAuth, getGroups);
groupRouter.post('/join', userAuth, joinGroup);
groupRouter.post('/leave', userAuth, leaveGroup);
groupRouter.get('/:groupId/messages', userAuth, getMessages);
groupRouter.post('/:groupId/messages', userAuth, sendMessage);
groupRouter.put('/:groupId/messages/:messageId/reactions', userAuth, setReaction);
groupRouter.delete('/:groupId/messages/:messageId', userAuth, deleteMessage);
groupRouter.post('/:groupId/messages/:messageId/save', userAuth, saveFromMessage);
groupRouter.get('/:groupId/upcoming', userAuth, getUpcoming);
groupRouter.get('/:groupId/plan', userAuth, getPlan);
groupRouter.get('/:groupId/plan/stamp', userAuth, getPlanStamp);
groupRouter.post('/:groupId/tasks', userAuth, createGroupTask);
groupRouter.patch('/:groupId/tasks/:taskId', userAuth, updateGroupTask);
groupRouter.delete('/:groupId/tasks/:taskId', userAuth, deleteGroupTask);
groupRouter.post('/:groupId/timetable', userAuth, createTimetable);
groupRouter.post('/:groupId/admins', userAuth, addAdmin);
groupRouter.delete('/:groupId/admins/:userId', userAuth, removeAdmin);
groupRouter.delete('/:groupId/members/:userId', userAuth, removeMember);
groupRouter.patch('/:groupId', userAuth, updateGroup);
groupRouter.delete('/:groupId', userAuth, deleteGroup);

export default groupRouter;
