import mongoose from 'mongoose';
import userModel from '../models/userModel.js';
import Friend from '../models/Friend.js';
import groupModel from '../models/groupMode.js';
import { LEGAL_VERSION } from '../utils/legal.js';
import { isValidPicture } from '../utils/images.js';

const MAX_BIO_LENGTH = 200;

export const getUserData = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await userModel.findById(userId).populate('friends', 'name email avatar');

        if (!user) {
            return res.json({ success: false, message: 'User not found.' });
        }

        res.json({
            success: true,
            userData: {
                _id: user._id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt,
                isAccountVerified: user.isAccountVerified,
                authProvider: user.authProvider,
                avatar: user.avatar,
                bio: user.bio,
                program: user.program,
                studyHoursPerDay: user.studyHoursPerDay,
                wellbeingGoal: user.wellbeingGoal,
                friends: user.friends,
                lastPSSSubmission: user.lastPSSSubmission,
                latestPSSScore: user.lastPSSSubmission ? user.latestPSSScore : null,
                lastWHOSubmission: user.lastWHOSubmission,
                latestWHOScore: user.lastWHOSubmission ? user.latestWHOScore : null,
                // ✅ Added profileTag
                profileTag: user.profileTag,
                termsVersion: user.termsVersion,
                currentLegalVersion: LEGAL_VERSION,
            }
        });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const userId = req.userId;
        const { studentName, program, studyHoursPerDay, wellbeingGoal, bio } = req.body;

        const updateFields = {};
        if (bio !== undefined) {
            if (String(bio).length > MAX_BIO_LENGTH) {
                return res.json({ success: false, message: `Your bio can be up to ${MAX_BIO_LENGTH} characters.` });
            }
            updateFields.bio = String(bio).trim();
        }
        if (studentName !== undefined) updateFields.name = studentName;
        if (program !== undefined) updateFields.program = program;
        if (studyHoursPerDay !== undefined) updateFields.studyHoursPerDay = studyHoursPerDay;
        if (wellbeingGoal !== undefined) updateFields.wellbeingGoal = wellbeingGoal;

        const updatedUser = await userModel.findByIdAndUpdate(
            userId,
            updateFields,
            { new: true, runValidators: true }
        ).populate('friends', 'name email avatar');

        if (!updatedUser) {
            return res.json({ success: false, message: 'User not found.' });
        }

        res.json({
            success: true,
            message: 'Profile updated successfully',
            userData: {
                name: updatedUser.name,
                bio: updatedUser.bio,
                program: updatedUser.program,
                studyHoursPerDay: updatedUser.studyHoursPerDay,
                wellbeingGoal: updatedUser.wellbeingGoal,
            }
        });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

// PUT /api/user/avatar  body: { avatar } a small image data URL, or '' to go back to initials.
export const updateAvatar = async (req, res) => {
    try {
        const { avatar } = req.body;
        if (!isValidPicture(avatar)) {
            return res.status(400).json({ success: false, message: 'That picture is too large or is not an image.' });
        }
        const user = await userModel.findByIdAndUpdate(req.userId, { avatar }, { returnDocument: 'after' });
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        res.json({ success: true, avatar: user.avatar });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/user/profile/:userId
// What another student sees: name, picture, program, bio and how you are connected. Only
// friends and people you share a group with can be looked up, so ids can't be used to browse
// everyone. Email, check-in results and study habits stay private.
export const getPublicProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(404).json({ success: false, message: 'Profile not found.' });
        }

        const [target, friendship, sharedGroups] = await Promise.all([
            userModel.findById(userId).select('name avatar program bio profileTag createdAt'),
            Friend.findOne({
                $or: [{ user: req.userId, friend: userId }, { user: userId, friend: req.userId }],
            }),
            groupModel.find({ members: { $all: [req.userId, userId] } }).select('name'),
        ]);
        if (!target) return res.status(404).json({ success: false, message: 'Profile not found.' });

        const isSelf = String(target._id) === req.userId;
        let relation = 'none';
        let requestId = null;
        if (friendship?.status === 'accepted') relation = 'friends';
        else if (friendship?.status === 'pending') {
            relation = String(friendship.user) === req.userId ? 'sent' : 'received';
            if (relation === 'received') requestId = friendship._id;
        }

        if (!isSelf && relation === 'none' && sharedGroups.length === 0) {
            return res.status(403).json({ success: false, message: 'You can only view profiles of friends and people in your groups.' });
        }

        res.json({
            success: true,
            profile: {
                _id: target._id,
                name: target.name,
                avatar: target.avatar,
                program: target.program,
                bio: target.bio,
                profileTag: target.profileTag,
                memberSince: target.createdAt,
                relation,
                requestId,
                sharedGroups: sharedGroups.map((g) => ({ _id: g._id, name: g.name })),
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/user/accept-terms
// Records agreement to the current Terms of Service and Privacy Policy.
export const acceptTerms = async (req, res) => {
    try {
        const user = await userModel.findByIdAndUpdate(
            req.userId,
            { termsVersion: LEGAL_VERSION, termsAcceptedAt: new Date() },
            { returnDocument: 'after' }
        );
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        res.json({ success: true, termsVersion: user.termsVersion });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
