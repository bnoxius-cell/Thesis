import mongoose from 'mongoose';

const taskShareSchema = new mongoose.Schema({
    shareTag: { type: String, required: true, unique: true, match: /^\d{6}$/ },
    title: { type: String, required: true },
    course: { type: String, required: true },
    description: { type: String, default: '' },
    dueDate: { type: Date, required: true },
    hours: { type: Number, default: 3, min: 0.5 },
    difficulty: { type: Number, default: 3, min: 1, max: 5 },
    importance: { type: Number, default: 3, min: 1, max: 5 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
}, { timestamps: true });

export default mongoose.models.taskShare || mongoose.model('taskShare', taskShareSchema);
