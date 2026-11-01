import mongoose from 'mongoose';
import { entrySchema } from './scheduleModel.js';

// One document per chat message. Kept out of the group document so a busy chat
// never bloats it, and so history can be paged by _id.
const groupMessageSchema = new mongoose.Schema({
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'group', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    type: { type: String, enum: ['text', 'task', 'schedule', 'deleted'], default: 'text' },
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
    // Snapshot of a shared schedule (pictures left out). Teammates copy entries from this,
    // so later edits or deletion of the original never change what was shared.
    schedule: {
        title: String,
        ownerName: String,
        theme: String,
        entries: [entrySchema],
    },
    // Emoji -> ids of the members who used it. Insertion order is display order.
    reactions: { type: Map, of: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }], default: {} },
    // A deleted message stays as a tombstone so other clients' polls can see it go.
    deletedAt: { type: Date, default: null },
    deletedByAdmin: { type: Boolean, default: false },
}, { timestamps: true });

// Feeds the poll's change list (reactions and deletes on messages the client already has).
groupMessageSchema.index({ group: 1, updatedAt: 1 });

export default mongoose.models.groupMessage || mongoose.model('groupMessage', groupMessageSchema);
