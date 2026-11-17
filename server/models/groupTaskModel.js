import mongoose from 'mongoose';

// A task that belongs to a group: one copy, edited by the group's admins, seen by every member.
// No subject link, since subjects are personal; `course` is a plain label. Field limits are the
// personal task limits, checked by the task payload readers in taskController.js.
const groupTaskSchema = new mongoose.Schema({
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'group', required: true, index: true },
    title: { type: String, required: true },
    course: { type: String, default: '' },
    description: { type: String, default: '' },
    dueDate: { type: Date, required: true },
    hours: { type: Number, default: 3 },
    difficulty: { type: Number, default: 3 },
    importance: { type: Number, default: 3 },
    isCompleted: { type: Boolean, default: false },
    // Set and cleared by the server when isCompleted changes, never by the client.
    completedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
}, { timestamps: true });

export default mongoose.models.groupTask || mongoose.model('groupTask', groupTaskSchema);
