import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { createGroup, getGroups, joinGroup, leaveGroup, deleteGroup, getMessages, sendMessage } from '../controllers/groupController.js';

const groupRouter = express.Router();

groupRouter.post('/', userAuth, createGroup);
groupRouter.get('/', userAuth, getGroups);
groupRouter.post('/join', userAuth, joinGroup);
groupRouter.post('/leave', userAuth, leaveGroup);
groupRouter.get('/:groupId/messages', userAuth, getMessages);
groupRouter.post('/:groupId/messages', userAuth, sendMessage);
groupRouter.delete('/:groupId', userAuth, deleteGroup);

export default groupRouter;
