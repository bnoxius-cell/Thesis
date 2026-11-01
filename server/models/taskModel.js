import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
    title: { type: String, required: true, maxlength: 120 },
    course: { type: String, default: '', maxlength: 80 },
    description: { type: String, default: '', maxlength: 1000 },
    dueDate: { type: Date, required: true },
    hours: { type: Number, default: 3, min: 0.5 },
    difficulty: { type: Number, default: 3, min: 1, max: 5 },
    importance: { type: Number, default: 3, min: 1, max: 5 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'group', default: null },
    shareTag: { type: String, match: /^\d{6}$/ },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.models.task || mongoose.model('task', taskSchema);
