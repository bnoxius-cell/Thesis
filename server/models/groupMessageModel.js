import mongoose from 'mongoose';

// One document per chat message. Kept out of the group document so a busy chat
// never bloats it, and so history can be paged by _id.
const groupMessageSchema = new mongoose.Schema({
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'group', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    type: { type: String, enum: ['text', 'task'], default: 'text' },
    text: { type: String, default: '', maxlength: 1000 },
    // Snapshot of a shared task. shareTag is what a teammate imports from.
    task: {
        shareTag: { type: String, match: /^\d{6}$/ },
        title: String,
        course: String,
        description: String,
        dueDate: Date,
        hours: Number,
        difficulty: Number,
        importance: Number,
    },
}, { timestamps: true });

export default mongoose.models.groupMessage || mongoose.model('groupMessage', groupMessageSchema);
