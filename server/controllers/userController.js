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
                wellbeingGoal: user.wellbeingGoal,
                friends: user.friends,
                lastPSSSubmission: user.lastPSSSubmission,
                latestPSSScore: user.lastPSSSubmission ? user.latestPSSScore : null,
                lastWHOSubmission: user.lastWHOSubmission,
                latestWHOScore: user.lastWHOSubmission ? user.latestWHOScore : null,
                // ✅ Added profileTag
                profileTag: user.profileTag,
            }
        });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const userId = req.userId;
        const { studentName, program, studyHoursPerDay, wellbeingGoal } = req.body;

        const updateFields = {};
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