import mongoose from 'mongoose';

// A reviewer made from one uploaded PDF. The PDF itself is never stored, only its extracted
// text (capped, hidden from queries unless asked for) so new questions can be made without
// uploading again. `version` goes up every time new content is generated, so sessions on an
// older question set aren't mixed into the current progress. Targeted review adds questions
// to the current set without bumping it.
const questionSchema = new mongoose.Schema({
    topic: { type: String, required: true },
    prompt: { type: String, required: true },
    options: {
        type: [String],
        validate: { validator: (v) => v.length === 4, message: 'A question needs exactly 4 options.' },
    },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    explanation: { type: String, default: '' },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    // '' for the questions made with the reviewer, otherwise the targeted batch that added it.
    batch: { type: String, default: '' },
});

const reviewerSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    title: { type: String, required: true, maxlength: 120 },
    // True while the title is just the file name. The AI's title replaces it once.
    autoTitle: { type: Boolean, default: false },
    course: { type: String, default: '', maxlength: 80 },
    source: {
        fileName: { type: String, default: '' },
        pages: { type: Number, default: 0 },
        chars: { type: Number, default: 0 },
        truncated: { type: Boolean, default: false },
    },
    sourceText: { type: String, default: '', select: false },
    questionTarget: { type: Number, default: 15 },

    status: { type: String, enum: ['processing', 'ready', 'failed'], default: 'processing' },
    error: { type: String, default: '' },
    // Ties a background generation run to this request. A run that finishes after the
    // reviewer was retried (or timed out) no longer matches and can't overwrite anything.
    jobId: { type: String, default: '' },
    requestedAt: { type: Date, default: Date.now },
    generatedAt: { type: Date, default: null },
    version: { type: Number, default: 0 },
    aiModel: { type: String, default: '' },

    summary: { type: String, default: '' },
    keyPoints: { type: [String], default: [] },
    keyTerms: { type: [{ _id: false, term: String, definition: String }], default: [] },
    // `parts`: which parts of a long PDF the topic came from (see splitIntoParts).
    topics: { type: [{ _id: false, name: String, summary: String, parts: [Number] }], default: [] },
    questions: { type: [questionSchema], default: [] },

    // The latest targeted review request: new questions on topics the student picked.
    targeted: {
        status: { type: String, enum: ['none', 'processing', 'ready', 'failed'], default: 'none' },
        topics: { type: [String], default: [] },
        count: { type: Number, default: 0 },
        added: { type: Number, default: 0 },
        batch: { type: String, default: '' },
        jobId: { type: String, default: '' },
        requestedAt: { type: Date, default: null },
        error: { type: String, default: '' },
    },
}, { timestamps: true });

reviewerSchema.index({ owner: 1, createdAt: -1 });

export default mongoose.models.reviewer || mongoose.model('reviewer', reviewerSchema);
