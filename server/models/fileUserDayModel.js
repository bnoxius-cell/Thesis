import mongoose from 'mongoose';

// One row per student per UTC day for the daily upload and link limits. Durable (unlike the
// in-memory burst limiter), so a restart can't hand out a fresh day. Rows expire after three days.
const fileUserDaySchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    day: { type: String, required: true },
    uploads: { type: Number, default: 0 },
    uploadBytes: { type: Number, default: 0 },
    links: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

fileUserDaySchema.index({ user: 1, day: 1 }, { unique: true });
fileUserDaySchema.index({ createdAt: 1 }, { expireAfterSeconds: 3 * 24 * 60 * 60 });

export default mongoose.models.fileUserDay || mongoose.model('fileUserDay', fileUserDaySchema);
