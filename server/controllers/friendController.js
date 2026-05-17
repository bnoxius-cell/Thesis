import Friend from '../models/Friend.js';
import userModel from '../models/userModel.js';

// Get friends list (accepted only)
export const getFriends = async (req, res) => {
    try {
        const userId = req.userId;
        const friendships = await Friend.find({
            $or: [{ user: userId }, { friend: userId }],
            status: 'accepted',
        }).populate('user friend', 'name email avatar profileTag');
        
        const friends = friendships.map(f => 
            f.user._id.toString() === userId ? f.friend : f.user
        );
        res.json({ success: true, friends });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Send friend request by profileTag
export const sendFriendRequest = async (req, res) => {
    try {
        const senderId = req.userId;
        const { profileTag } = req.body;

        const receiver = await userModel.findOne({ profileTag });
        if (!receiver) {
            return res.status(404).json({ success: false, message: 'User not found with this tag.' });
        }
        if (receiver._id.toString() === senderId) {
            return res.status(400).json({ success: false, message: 'You cannot add yourself as a friend.' });
        }

        const existing = await Friend.findOne({
            $or: [
                { user: senderId, friend: receiver._id },
                { user: receiver._id, friend: senderId },
            ],
        });
        if (existing) {
            if (existing.status === 'accepted') {
                return res.status(400).json({ success: false, message: 'Already friends.' });
            }
            if (existing.status === 'pending') {
                return res.status(400).json({ success: false, message: 'Friend request already sent.' });
            }
        }

        const newFriend = new Friend({
            user: senderId,
            friend: receiver._id,
            status: 'pending',
        });
        await newFriend.save();
        res.json({ success: true, message: 'Friend request sent.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Accept friend request
export const acceptFriendRequest = async (req, res) => {
    try {
        const userId = req.userId;
        const { requestId } = req.params;

        const friendRequest = await Friend.findOne({ _id: requestId, friend: userId, status: 'pending' });
        if (!friendRequest) {
            return res.status(404).json({ success: false, message: 'Request not found.' });
        }
        friendRequest.status = 'accepted';
        await friendRequest.save();
        res.json({ success: true, message: 'Friend request accepted.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Remove friend
export const removeFriend = async (req, res) => {
    try {
        const userId = req.userId;
        const { friendId } = req.params;

        const friendship = await Friend.findOneAndDelete({
            $or: [
                { user: userId, friend: friendId },
                { user: friendId, friend: userId },
            ],
            status: 'accepted',
        });
        if (!friendship) {
            return res.status(404).json({ success: false, message: 'Friendship not found.' });
        }
        res.json({ success: true, message: 'Friend removed.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get pending friend requests (incoming)
export const getPendingRequests = async (req, res) => {
    try {
        const userId = req.userId;
        const requests = await Friend.find({ friend: userId, status: 'pending' })
            .populate('user', 'name email avatar profileTag');
        res.json({ success: true, requests });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};