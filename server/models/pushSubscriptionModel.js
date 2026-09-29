import mongoose from 'mongoose';

// One document per browser/device that agreed to receive push alerts. The endpoint is
// unique to that browser, so re-subscribing the same device just updates its row.
const pushSubscriptionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true },
    },
    userAgent: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.models.pushSubscription || mongoose.model('pushSubscription', pushSubscriptionSchema);
