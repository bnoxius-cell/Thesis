import mongoose from 'mongoose';

const pssResponseSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    score: { type: Number, required: true, min: 0, max: 40 },
    responses: { type: [Number], required: true }, // array of 10 answers (0-4 each)
    createdAt: { type: Date, default: Date.now },
});

const whoResponseSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    responses: { type: [Number], required: true }, // array of 5 answers (0-5 each)
    createdAt: { type: Date, default: Date.now },
});

export const WHOResponse = mongoose.models.WHOResponse || mongoose.model('WHOResponse', whoResponseSchema);
export const PSSResponse = mongoose.models.PSSResponse || mongoose.model('PSSResponse', pssResponseSchema);