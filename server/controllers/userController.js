import userModel from '../models/userModel.js';

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
                isAccountVerified: user.isAccountVerified,
                authProvider: user.authProvider,
                avatar: user.avatar,
                bio: user.bio,
                program: user.program,
                studyHoursPerDay: user.studyHoursPerDay,
                sleepHours: user.sleepHours,
                wellbeingGoal: user.wellbeingGoal,
                friends: user.friends
            }
        })
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const userId = req.userId;
        const { name, bio, program, studyHoursPerDay, sleepHours, wellbeingGoal } = req.body;

        const updatedUser = await userModel.findByIdAndUpdate(
            userId,
            { name, bio, program, studyHoursPerDay, sleepHours, wellbeingGoal },
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
                sleepHours: updatedUser.sleepHours,
                wellbeingGoal: updatedUser.wellbeingGoal,
            }
        });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};