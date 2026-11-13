import mongoose from 'mongoose';

// One Learning Mode session. `questions` is the order they were served in; answers are graded
// on the server, so the answer key never reaches the browser before a question is answered.
// Unfinished sessions are kept (finishedAt null) but don't count toward progress.
const answerSchema = new mongoose.Schema({
    question: { type: mongoose.Schema.Types.ObjectId, required: true },
    // A multiple choice or true/false answer is `choice`; a typed one is `text`, or `entries` for
    // enumeration with `got` of `of` items right. `covered` and `note` are for essay checks.
    choice: { type: Number, min: 0, max: 3 },
    text: { type: String, default: '', maxlength: 1000 },
    entries: { type: [String], default: [], validate: { validator: (v) => v.length <= 6, message: 'At most 6 entries.' } },
    got: { type: Number, default: null },
    of: { type: Number, default: null },
    covered: { type: [Number], default: [] },
    note: { type: String, default: '', maxlength: 300 },
    correct: { type: Boolean, required: true },
    answeredAt: { type: Date, default: Date.now },
}, { _id: false });

const reviewerAttemptSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'reviewer', required: true },
    version: { type: Number, required: true },
    mode: { type: String, enum: ['all', 'weak', 'targeted'], default: 'all' },
    questions: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    answers: { type: [answerSchema], default: [] },

    finishedAt: { type: Date, default: null },
    correct: { type: Number, default: 0 },
    answered: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    score: { type: Number, default: null },
    topicStats: {
        type: [{ _id: false, topic: String, correct: Number, total: Number }],
        default: [],
    },
}, { timestamps: true });

reviewerAttemptSchema.index({ reviewer: 1, user: 1, createdAt: -1 });

export default mongoose.models.reviewerAttempt || mongoose.model('reviewerAttempt', reviewerAttemptSchema);
