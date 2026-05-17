import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, default: '' },
    bio: { type: String, default: '' },
    program: { type: String, default: 'BS Information Technology' },
    studyHoursPerDay: { type: Number, default: 4 },
    sleepHours: { type: Number, default: 7 },
    wellbeingGoal: { type: String, enum: ['steady', 'catch-up', 'high-performance'], default: 'steady' },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    googleId: { type: String, sparse: true },
    avatar: { type: String, default: '' },
    verifyEmailOtp: { type: String, default: '' },
    verifyEmailOtpExpireAt: { type: Number, default: 0 },
    isAccountVerified: { type: Boolean, default: false },
    resetPasswordOtp: { type: String, default: '' },
    resetPasswordOtpExpireAt: { type: Number, default: 0 },
    lastPSSSubmission: { type: Date, default: null },
    latestPSSScore: { type: Number, default: null },
    lastWHOSubmission: { type: Date, default: null },
    latestWHOScore: { type: Number, default: null },
    profileTag: { type: String, unique: true, sparse: true, default: null },
});

function generateProfileTag() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// CORRECTED pre‑save hook – no `next` parameter, just an async function
userSchema.pre('save', async function() {
    if (!this.profileTag) {
        let isUnique = false;
        let newTag;
        while (!isUnique) {
            newTag = generateProfileTag();
            const existing = await mongoose.models.user?.findOne({ profileTag: newTag });
            if (!existing) isUnique = true;
        }
        this.profileTag = newTag;
    }
});

const userModel = mongoose.models.user || mongoose.model('user', userSchema);
export default userModel;