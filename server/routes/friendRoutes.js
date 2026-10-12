import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { getFriends, getPendingRequests, sendFriendRequest, acceptFriendRequest, removeFriend, deleteFriendRequest, getSentRequests } from '../controllers/friendController.js';

const friendRouter = express.Router();

friendRouter.get('/', userAuth, getFriends);
friendRouter.get('/pending', userAuth, getPendingRequests);
friendRouter.post('/request', userAuth, sendFriendRequest);
friendRouter.put('/accept/:requestId', userAuth, acceptFriendRequest);
friendRouter.get('/sent', userAuth, getSentRequests);
friendRouter.delete('/request/:requestId', userAuth, deleteFriendRequest);
friendRouter.delete('/:friendId', userAuth, removeFriend);

export default friendRouter;