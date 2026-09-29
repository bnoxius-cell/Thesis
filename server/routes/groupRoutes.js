import express from 'express';
import userAuth from '../middleware/userAuth.js';
import {
    createGroup, getGroups, joinGroup, leaveGroup, deleteGroup, getMessages, sendMessage,
    updateGroup, addAdmin, removeAdmin, removeMember,
} from '../controllers/groupController.js';

const groupRouter = express.Router();

groupRouter.post('/', userAuth, createGroup);
groupRouter.get('/', userAuth, getGroups);
groupRouter.post('/join', userAuth, joinGroup);
groupRouter.post('/leave', userAuth, leaveGroup);
groupRouter.get('/:groupId/messages', userAuth, getMessages);
groupRouter.post('/:groupId/messages', userAuth, sendMessage);
groupRouter.post('/:groupId/admins', userAuth, addAdmin);
groupRouter.delete('/:groupId/admins/:userId', userAuth, removeAdmin);
groupRouter.delete('/:groupId/members/:userId', userAuth, removeMember);
groupRouter.patch('/:groupId', userAuth, updateGroup);
groupRouter.delete('/:groupId', userAuth, deleteGroup);

export default groupRouter;
