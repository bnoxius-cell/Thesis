import { PSSResponse, WHOResponse } from '../models/Survey.js';
import userModel from '../models/userModel.js';
import { scorePSS, scoreWHO } from '../utils/surveyScoring.js';
import { isCheckinContext } from '../utils/checkinContext.js';
import { isId, serverError } from '../utils/httpErrors.js';

export const submitPSS = async (req, res) => {
    try {
        const userId = req.userId;
        const { responses } = req.body;

        // The score the browser sends is ignored: it is worked out here from the answers.
        const score = scorePSS(responses);
        if (score === null) {
            return res.status(400).json({ success: false, message: 'Please answer all 10 questions.' });
        }

        const newResponse = new PSSResponse({ user: userId, score, responses });
        await newResponse.save();

        await userModel.findByIdAndUpdate(userId, {
            lastPSSSubmission: new Date(),
            latestPSSScore: score,
        });

        res.json({ success: true, message: 'PSS-10 survey saved successfully.', score, id: newResponse._id });
    } catch (error) {
        serverError(res, 'Submit PSS error', error);
    }
};

export const submitWHO = async (req, res) => {
    try {
        const userId = req.userId;
        const { responses } = req.body;

        const score = scoreWHO(responses);
        if (score === null) {
            return res.status(400).json({ success: false, message: 'Please answer all 5 questions.' });
        }

        const newResponse = new WHOResponse({ user: userId, score, responses });
        await newResponse.save();

        await userModel.findByIdAndUpdate(userId, {
            lastWHOSubmission: new Date(),
            latestWHOScore: score,
        });

        res.json({ success: true, message: 'WHO-5 survey saved successfully.', score, id: newResponse._id });
    } catch (error) {
        serverError(res, 'Submit WHO error', error);
    }
};

const MODELS = { pss: PSSResponse, who: WHOResponse };

// The user's label mirrors the newest tagged row across both check-ins (null when none is tagged).
const syncUserContext = async (userId) => {
    const newest = await Promise.all(
        Object.values(MODELS).map((Model) => Model.findOne({ user: userId, context: { $ne: null } }).sort({ createdAt: -1 }).lean()),
    );
    const latest = newest.filter(Boolean).sort((a, b) => b.createdAt - a.createdAt)[0];
    await userModel.findByIdAndUpdate(userId, {
        checkInContext: latest?.context ?? null,
        checkInContextAt: latest?.createdAt ?? null,
    });
};

// Tag (or clear) what was behind one check-in. Never touches the score or answers.
export const setContext = async (req, res) => {
    try {
        const { kind, id } = req.params;
        const Model = MODELS[kind];
        if (!Model || !isId(id)) return res.status(404).json({ success: false, message: 'Check-in not found.' });

        const { context } = req.body;
        if (context !== null && !isCheckinContext(context)) {
            return res.status(400).json({ success: false, message: 'Pick one of the options.' });
        }

        const row = await Model.findOneAndUpdate({ _id: id, user: req.userId }, { context }, { returnDocument: 'after' });
        if (!row) return res.status(404).json({ success: false, message: 'Check-in not found.' });

        await syncUserContext(req.userId);
        res.json({ success: true, context: row.context });
    } catch (error) {
        serverError(res, 'Set check-in context error', error);
    }
};

// Last 5 results of each check-in, newest first, for the Wellbeing page.
export const getHistory = async (req, res) => {
    try {
        const pick = (rows) => rows.map((row) => ({ score: row.score, context: row.context ?? null, createdAt: row.createdAt }));
        const [pss, who] = await Promise.all([
            PSSResponse.find({ user: req.userId }).sort({ createdAt: -1 }).limit(5).lean(),
            WHOResponse.find({ user: req.userId }).sort({ createdAt: -1 }).limit(5).lean(),
        ]);
        res.json({ success: true, pss: pick(pss), who: pick(who) });
    } catch (error) {
        serverError(res, 'Survey history error', error);
    }
};
