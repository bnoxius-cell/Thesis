import mongoose from 'mongoose';

const generateShareTag = () => String(Math.floor(100000 + Math.random() * 900000));

const taskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    course: { type: String, required: true },
    description: { type: String, default: '' },
    dueDate: { type: Date, required: true },
    hours: { type: Number, default: 3, min: 0.5 },
    difficulty: { type: Number, default: 3, min: 1, max: 5 },
    importance: { type: Number, default: 3, min: 1, max: 5 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'group', default: null },
    shareTag: { type: String, unique: true, sparse: true },
    isCompleted: { type: Boolean, default: false },
}, { timestamps: true });

// Generate a unique 6-digit code before validation/save.
taskSchema.pre('validate', async function() {
    if (!this.shareTag) {
        let isUnique = false;
        let newTag;
        while (!isUnique) {
            newTag = generateShareTag();
            const existing = await this.constructor.exists({ shareTag: newTag });
            if (!existing) isUnique = true;
        }
        this.shareTag = newTag;
    }
});

export default mongoose.models.task || mongoose.model('task', taskSchema);
