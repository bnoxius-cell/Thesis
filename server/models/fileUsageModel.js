import mongoose from 'mongoose';

// Server-wide file counters (plan 18, 3.3). `_id: 'storage'` holds the stored bytes; one
// `month:YYYY-MM` (UTC) document per month holds the R2 operations and upload traffic we reserved,
// plus what the reconciliation saw on Cloudflare. No user ids here.
const fileUsageSchema = new mongoose.Schema({
    _id: { type: String },
    bytes: { type: Number, default: 0 },
    classA: { type: Number, default: 0 },
    classB: { type: Number, default: 0 },
    uploadBytes: { type: Number, default: 0 },
    // Alert thresholds already emailed this month, like "classB:80".
    alerts: { type: [String], default: [] },
    real: {
        classA: { type: Number, default: 0 },
        classB: { type: Number, default: 0 },
        storageBytes: { type: Number, default: 0 },
        checkedAt: { type: Date, default: null },
    },
    analyticsFailures: { type: Number, default: 0 },
    // '' = not tripped, otherwise the reason. Checked inside every reservation's filter.
    tripped: {
        reads: { type: String, default: '' },
        writes: { type: String, default: '' },
    },
    resumeKey: { type: String, default: '' },
    baseline: {
        classA: { type: Number, default: 0 },
        classB: { type: Number, default: 0 },
    },
}, { versionKey: false });

export default mongoose.models.fileUsage || mongoose.model('fileUsage', fileUsageSchema);
