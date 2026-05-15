import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { createGroup, getGroups, joinGroup, leaveGroup, deleteGroup } from '../controllers/groupController.js';

const groupRouter = express.Router();

groupRouter.post('/', userAuth, createGroup);
groupRouter.get('/', userAuth, getGroups);
groupRouter.post('/join', userAuth, joinGroup);
groupRouter.post('/leave', userAuth, leaveGroup);
groupRouter.delete('/:groupId', userAuth, deleteGroup);

export default groupRouter;