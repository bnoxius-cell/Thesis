import mongoose from 'mongoose';
import { MAX_SOURCES } from '../utils/reviewerSource.js';
import { QUESTION_TYPES, DEFAULT_QUESTION_TYPE } from '../utils/reviewerContent.js';

// A reviewer made from one or more files (PDF, Word, PowerPoint) or pasted notes. The files
// themselves are never stored, only the extracted text (capped, hidden from queries unless asked
// for) so new questions can be made without uploading again. `version` goes up every time new content is generated, so sessions on an
// older question set aren't mixed into the current progress. Targeted review adds questions
// to the current set without bumping it.
// How many options each kind of question has. Questions made before kinds existed have no `type`
// and read as multiple choice. Typed answers are graded against `answer` and `accepted` (and
// `items` for enumeration); `points` is the essay key. None of these reach a browser before the
// question is answered.
const OPTION_COUNTS = { mc: 4, tf: 2 };
const hasOptions = (type) => type in OPTION_COUNTS;

const questionSchema = new mongoose.Schema({
    topic: { type: String, required: true },
    type: { type: String, enum: ['mc', 'tf', 'id', 'fill', 'enum', 'essay'], default: 'mc' },
    prompt: { type: String, required: true },
    options: {
        type: [String],
        validate: {
            // A function, not an arrow: it reads the question's own type.
            validator(v) { return v.length === (OPTION_COUNTS[this.type ?? 'mc'] ?? 0); },
            message: 'A question has the wrong number of options for its type.',
        },
    },
    correctIndex: {
        type: Number,
        min: 0,
        max: 3,
        default: null,
        required: function () { return hasOptions(this.type ?? 'mc'); },
    },
    answer: { type: String, default: '', maxlength: 800 },
    accepted: { type: [String], default: [], validate: { validator: (v) => v.length <= 4, message: 'At most 4 accepted answers.' } },
    items: {
        type: [{ _id: false, answer: String, accepted: [String] }],
        default: [],
        validate: { validator: (v) => v.length <= 6, message: 'At most 6 items.' },
    },
    points: { type: [String], default: [], validate: { validator: (v) => v.length <= 4, message: 'At most 4 key points.' } },
    explanation: { type: String, default: '' },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    // '' for the questions made with the reviewer, otherwise the targeted batch that added it.
    batch: { type: String, default: '' },
});

// One source of a reviewer. `file` only points at the Study file it came from, if any; nothing reads it again.
// Its own schema because a plain nested object can't have a field called `type`.
const sourceItemSchema = new mongoose.Schema({
    type: { type: String, enum: ['pdf', 'docx', 'pptx', 'image', 'notes'], required: true },
    fileName: { type: String, default: '' },
    pages: { type: Number, default: 0 },
    slides: { type: Number, default: 0 },
    chars: { type: Number, default: 0 },
    truncated: { type: Boolean, default: false },
    bytes: { type: Number, default: 0 },
    file: { type: mongoose.Schema.Types.ObjectId, ref: 'file', default: null },
    read: { type: String, enum: ['text', 'picture'], default: 'text' },
    skipped: { type: Boolean, default: false },
}, { _id: false });

const reviewerSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    title: { type: String, required: true, maxlength: 120 },
    // True while the title is just the file name. The AI's title replaces it once.
    autoTitle: { type: Boolean, default: false },
    course: { type: String, default: '', maxlength: 80 },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'subject', default: null },
    // The summary shown in the list; `sources` has one entry per file. `fingerprint` (never sent to a
    // client) is how a double submit is recognised. Reviewers made before this have neither a type
    // nor `sources`: they read as one PDF.
    source: {
        type: { type: String, enum: ['pdf', 'docx', 'pptx', 'image', 'notes', 'mixed'], default: 'pdf' },
        fileName: { type: String, default: '' },
        count: { type: Number, default: 1 },
        pages: { type: Number, default: 0 },
        slides: { type: Number, default: 0 },
        chars: { type: Number, default: 0 },
        truncated: { type: Boolean, default: false },
        bytes: { type: Number, default: 0 },
        fingerprint: { type: String, default: '' },
    },
    sources: { type: [sourceItemSchema], default: [], validate: { validator: (v) => v.length <= MAX_SOURCES, message: `At most ${MAX_SOURCES} sources.` } },
    sourceText: { type: String, default: '', select: false },
    questionTarget: { type: Number, default: 15 },
    questionType: { type: String, enum: QUESTION_TYPES, default: DEFAULT_QUESTION_TYPE },

    status: { type: String, enum: ['processing', 'ready', 'failed'], default: 'processing' },
    error: { type: String, default: '' },
    // Ties a background generation run to this request. A run that finishes after the
    // reviewer was retried (or timed out) no longer matches and can't overwrite anything.
    jobId: { type: String, default: '' },
    requestedAt: { type: Date, default: Date.now },
    generatedAt: { type: Date, default: null },
    version: { type: Number, default: 0 },
    aiModel: { type: String, default: '' },
    // Where a long run is up to, and a plain message on a reviewer that is ready but short of what
    // was asked.
    progress: {
        stage: { type: String, enum: ['', 'reading', 'writing'], default: '' },
        done: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
    },
    progressAt: { type: Date, default: null },
    note: { type: String, default: '' },

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
    // `message:<id>` for a copy saved from a group chat, '' otherwise.
    copiedFrom: { type: String, default: '' },
}, { timestamps: true });

reviewerSchema.index({ owner: 1, createdAt: -1 });
// One saved copy per student per shared message, even when two saves arrive at once.
reviewerSchema.index({ owner: 1, copiedFrom: 1 }, { unique: true, partialFilterExpression: { copiedFrom: { $gt: '' } } });

export default mongoose.models.reviewer || mongoose.model('reviewer', reviewerSchema);
