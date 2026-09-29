import webpush from 'web-push';
import pushSubscriptionModel from '../models/pushSubscriptionModel.js';

// Web Push wrapper. Push only works when VAPID keys are set in the environment
// (see server/.env). Without them everything here quietly does nothing, so the app
// still runs fine, it just falls back to the in-app inbox. Also the seam tests mock.
let configured = null;

const configure = () => {
    if (configured !== null) return configured;
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, SENDER_EMAIL } = process.env;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        configured = false;
        return configured;
    }
    try {
        const subject = VAPID_SUBJECT || `mailto:${SENDER_EMAIL || 'noreply@stresscare.app'}`;
        webpush.setVapidDetails(subject, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
        configured = true;
    } catch (error) {
        console.error('Web Push disabled, bad VAPID config:', error.message);
        configured = false;
    }
    return configured;
};

export const isPushConfigured = () => configure();

export const getPublicKey = () => (configure() ? process.env.VAPID_PUBLIC_KEY : null);

// payload: { title, body, url, tag }. Never throws, a failed push must not break
// the request that triggered it. Dead subscriptions (uninstalled app, revoked
// permission) come back as 404/410 and get cleaned up here.
export const sendPushToUser = async (userId, payload) => {
    if (!configure()) return;
    try {
        const subscriptions = await pushSubscriptionModel.find({ user: userId });
        if (!subscriptions.length) return;

        const body = JSON.stringify(payload);
        await Promise.all(subscriptions.map(async (sub) => {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
                    body,
                    { TTL: 60 * 60 * 24 }
                );
            } catch (error) {
                if (error.statusCode === 404 || error.statusCode === 410) {
                    await pushSubscriptionModel.deleteOne({ _id: sub._id });
                } else {
                    console.error('Push send failed:', error.statusCode || error.message);
                }
            }
        }));
    } catch (error) {
        console.error('Push error:', error.message);
    }
};
