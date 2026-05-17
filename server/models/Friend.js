import mongoose from 'mongoose';

const friendSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    friend: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'blocked'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
});

// Ensure unique pair (user, friend)
friendSchema.index({ user: 1, friend: 1 }, { unique: true });

export default mongoose.models.Friend || mongoose.model('Friend', friendSchema);