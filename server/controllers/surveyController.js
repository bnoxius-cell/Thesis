import { PSSResponse, WHOResponse } from '../models/Survey.js';
import userModel from '../models/userModel.js';

export const submitPSS = async (req, res) => {
    try {
        const { score, responses } = req.body;
        const userId = req.userId;

        if (score < 0 || score > 40) {
            return res.status(400).json({ success: false, message: 'Invalid score range.' });
        }

        const newResponse = new PSSResponse({ user: userId, score, responses });
        await newResponse.save();

        await userModel.findByIdAndUpdate(userId, {
            lastPSSSubmission: new Date(),
            latestPSSScore: score,
        });

        res.json({ success: true, message: 'PSS-10 survey saved successfully.' });
    } catch (error) {
        console.error('Submit PSS error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const submitWHO = async (req, res) => {
    try {
        const { score, responses } = req.body;
        const userId = req.userId;

        if (score < 0 || score > 100) {
            return res.status(400).json({ success: false, message: 'Invalid score range.' });
        }

        const newResponse = new WHOResponse({ user: userId, score, responses });
        await newResponse.save();

        await userModel.findByIdAndUpdate(userId, {
            lastWHOSubmission: new Date(),
            latestWHOScore: score,
        });

        res.json({ success: true, message: 'WHO-5 survey saved successfully.' });
    } catch (error) {
        console.error('Submit WHO error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};