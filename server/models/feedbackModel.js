import mongoose from 'mongoose';

export const FEEDBACK_KINDS = ['idea', 'problem', 'unclear', 'other'];
export const FEEDBACK_DEVICES = ['phone', 'tablet', 'desktop'];
export const FEEDBACK_LIMITS = { min: 10, max: 1000, perDay: 5 };
const PAGE_MAX = 160;

// One piece of feedback a signed-in student sent from the app. The owner reads it in the team
// inbox or in Atlas and moves `status` along by hand (there is no admin page).
const feedbackSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    kind: { type: String, enum: FEEDBACK_KINDS, required: true },
    message: { type: String, required: true, minlength: FEEDBACK_LIMITS.min, maxlength: FEEDBACK_LIMITS.max },
    page: { type: String, default: '', maxlength: PAGE_MAX },
    device: { type: String, enum: [...FEEDBACK_DEVICES, ''], default: '' },
    canContact: { type: Boolean, default: false },
    status: { type: String, enum: ['new', 'read', 'done'], default: 'new' },
}, { timestamps: true });

feedbackSchema.index({ user: 1, createdAt: -1 });
feedbackSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.feedback || mongoose.model('feedback', feedbackSchema);
