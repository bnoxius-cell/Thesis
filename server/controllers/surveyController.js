import { PSSResponse, WHOResponse } from '../models/Survey.js';
import userModel from '../models/userModel.js';
import { scorePSS, scoreWHO } from '../utils/surveyScoring.js';
import { serverError } from '../utils/httpErrors.js';

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

        res.json({ success: true, message: 'PSS-10 survey saved successfully.', score });
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

        res.json({ success: true, message: 'WHO-5 survey saved successfully.', score });
    } catch (error) {
        serverError(res, 'Submit WHO error', error);
    }
};
