import mongoose from 'mongoose';

// One row per AI generation request, used for the per-user daily cap (everyone shares one
// Gemini API key and its quota). Separate from reviewers so deleting a reviewer doesn't give
// the request back. Rows expire on their own after two days.
const aiRequestSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    kind: { type: String, enum: ['reviewer'], default: 'reviewer' },
    at: { type: Date, default: Date.now },
});

aiRequestSchema.index({ user: 1, at: -1 });
aiRequestSchema.index({ at: 1 }, { expireAfterSeconds: 2 * 24 * 60 * 60 });

export default mongoose.models.aiRequest || mongoose.model('aiRequest', aiRequestSchema);
