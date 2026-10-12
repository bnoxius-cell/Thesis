import mongoose from 'mongoose';
import userModel from '../models/userModel.js';
import Friend from '../models/Friend.js';
import groupModel from '../models/groupMode.js';
import { LEGAL_VERSION } from '../utils/legal.js';
import { isValidPicture } from '../utils/images.js';

const MAX_BIO_LENGTH = 200;
const MAX_NAME_LENGTH = 60;
const MAX_PROGRAM_LENGTH = 80;

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
                sleepHours: user.sleepHours,
                hasRegularSleepSchedule: user.hasRegularSleepSchedule,
                usualSleepStart: user.usualSleepStart,
                usualWakeTime: user.usualWakeTime,
                travelMinutesPerDay: user.travelMinutesPerDay,
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
        const { studentName, program, studyHoursPerDay, sleepHours, hasRegularSleepSchedule, usualSleepStart, usualWakeTime, travelMinutesPerDay, wellbeingGoal, bio } = req.body;

        const updateFields = {};
        if (bio !== undefined) {
            if (String(bio).length > MAX_BIO_LENGTH) {
                return res.json({ success: false, message: `Your bio can be up to ${MAX_BIO_LENGTH} characters.` });
            }
            updateFields.bio = String(bio).trim();
        }
        if (studentName !== undefined) {
            const name = typeof studentName === 'string' ? studentName.trim() : '';
            if (!name) return res.json({ success: false, message: 'Please enter your name.' });
            if (name.length > MAX_NAME_LENGTH) {
                return res.json({ success: false, message: `Your name can be up to ${MAX_NAME_LENGTH} characters.` });
            }
            updateFields.name = name;
        }
        if (program !== undefined) {
            const value = typeof program === 'string' ? program.trim() : '';
            if (!value || value.length > MAX_PROGRAM_LENGTH) {
                return res.json({ success: false, message: `Your program can be up to ${MAX_PROGRAM_LENGTH} characters.` });
            }
            updateFields.program = value;
        }
        const numberInRange = (value, min, max, label) => {
            const number = Number(value);
            if (value === '' || value === null || !Number.isFinite(number) || number < min || number > max) {
                return { error: `${label} must be between ${min} and ${max}.` };
            }
            return { number };
        };
        for (const [key, value, min, max, label] of [
            ['studyHoursPerDay', studyHoursPerDay, 1, 12, 'Study hours per day'],
            ['sleepHours', sleepHours, 4, 12, 'Sleep hours'],
            ['travelMinutesPerDay', travelMinutesPerDay, 0, 240, 'Travel minutes per day'],
        ]) {
            if (value === undefined) continue;
            const { number, error } = numberInRange(value, min, max, label);
            if (error) return res.json({ success: false, message: error });
            updateFields[key] = number;
        }
        if (hasRegularSleepSchedule !== undefined) updateFields.hasRegularSleepSchedule = Boolean(hasRegularSleepSchedule);
        if (usualSleepStart !== undefined) updateFields.usualSleepStart = usualSleepStart;
        if (usualWakeTime !== undefined) updateFields.usualWakeTime = usualWakeTime;
        if (wellbeingGoal !== undefined) updateFields.wellbeingGoal = wellbeingGoal;

        const updatedUser = await userModel.findByIdAndUpdate(
            userId,
            updateFields,
            { returnDocument: 'after', runValidators: true }
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
                sleepHours: updatedUser.sleepHours,
                hasRegularSleepSchedule: updatedUser.hasRegularSleepSchedule,
                usualSleepStart: updatedUser.usualSleepStart,
                usualWakeTime: updatedUser.usualWakeTime,
                travelMinutesPerDay: updatedUser.travelMinutesPerDay,
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
