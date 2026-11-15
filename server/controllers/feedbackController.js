import feedbackModel, { FEEDBACK_KINDS, FEEDBACK_DEVICES, FEEDBACK_LIMITS } from '../models/feedbackModel.js';
import userModel from '../models/userModel.js';
import { hit } from '../utils/rateLimit.js';
import { sendFeedbackEmail } from '../utils/emailService.js';
import { serverError } from '../utils/httpErrors.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const BURST = { limit: 1, windowMs: 30 * 1000 };
const TEAM_EMAILS_PER_DAY = { limit: 100, windowMs: DAY_MS };
const PAGE_PATH = /^\/[A-Za-z0-9/_-]{0,159}$/;
// Everything below space except tab and newline, plus DEL.
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/g;

const cleanMessage = (value) => (typeof value === 'string'
    ? value.replace(CONTROL_CHARS, '').replace(/\n{3,}/g, '\n\n').trim()
    : '');

// Same text in a different case or with different spacing counts as the same message.
const comparable = (text) => text.toLowerCase().replace(/\s+/g, ' ');

// Only the path survives: no query, no hash, nothing outside the route alphabet.
const cleanPage = (value) => {
    if (typeof value !== 'string') return '';
    const path = value.split(/[?#]/)[0];
    return PAGE_PATH.test(path) ? path : '';
};

// Read per request, never at module load, so tests (and a changed env var) take effect.
const teamAddresses = () => (process.env.FEEDBACK_EMAIL || '')
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean);

// Fire and forget: a failed email never fails the student's request.
const mailTeam = (feedback, user) => {
    const addresses = teamAddresses();
    if (!addresses.length || !hit('feedback:email', TEAM_EMAILS_PER_DAY).ok) return;
    const details = {
        kind: feedback.kind,
        message: feedback.message,
        page: feedback.page,
        device: feedback.device,
        canContact: feedback.canContact,
        createdAt: feedback.createdAt,
        name: user.name,
        email: user.email,
    };
    addresses.forEach((to) => {
        sendFeedbackEmail({ to, ...details }).catch((error) => console.error('Feedback email failed:', error));
    });
};

export const sendFeedback = async (req, res) => {
    try {
        const user = await userModel.findById(req.userId).select('name email isAccountVerified').lean();
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
        if (!user.isAccountVerified) return res.status(403).json({ success: false, message: 'Verify your email first.' });

        const { kind, device, canContact } = req.body;
        if (!FEEDBACK_KINDS.includes(kind)) {
            return res.status(400).json({ success: false, message: 'Pick what kind of feedback this is.' });
        }
        const message = cleanMessage(req.body.message);
        if (message.length < FEEDBACK_LIMITS.min) {
            return res.status(400).json({ success: false, message: 'Tell us a little more (at least 10 characters).' });
        }
        if (message.length > FEEDBACK_LIMITS.max) {
            return res.status(400).json({ success: false, message: 'Keep it under 1,000 characters.' });
        }

        if (!hit(`feedback:${req.userId}`, BURST).ok) {
            return res.status(429).json({ success: false, message: 'Give it a moment before sending more.' });
        }
        const recent = await feedbackModel
            .find({ user: req.userId, createdAt: { $gte: new Date(Date.now() - DAY_MS) } })
            .select('message')
            .lean();
        if (recent.length >= FEEDBACK_LIMITS.perDay) {
            return res.status(429).json({
                success: false,
                message: "That's plenty for today. Thanks for helping, you can send more tomorrow.",
            });
        }
        if (recent.some((sent) => comparable(sent.message) === comparable(message))) {
            return res.status(409).json({ success: false, message: 'You already sent this one. Thanks!' });
        }

        const feedback = await feedbackModel.create({
            user: req.userId,
            kind,
            message,
            page: cleanPage(req.body.page),
            device: FEEDBACK_DEVICES.includes(device) ? device : '',
            canContact: canContact === true,
        });
        res.status(201).json({ success: true });
        mailTeam(feedback, user);
    } catch (error) {
        serverError(res, 'sendFeedback', error);
    }
};
