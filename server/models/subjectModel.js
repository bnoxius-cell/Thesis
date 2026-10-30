import mongoose from 'mongoose';

// The colour keys match the --subject-<key> tokens in client/src/styles/tokens.css.
export const SUBJECT_COLORS = ['blue', 'teal', 'green', 'olive', 'amber', 'orange', 'violet', 'slate'];
export const SUBJECT_LIMITS = { name: 80, code: 20, term: 40, maxActive: 30 };

// A class the student studies for. Tasks and reviewers point at it with an optional `subject`
// id; their `course` text stays as the display label and as the fallback for unlinked items.
const subjectSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: SUBJECT_LIMITS.name },
    code: { type: String, default: '', trim: true, maxlength: SUBJECT_LIMITS.code },
    term: { type: String, default: '', trim: true, maxlength: SUBJECT_LIMITS.term },
    color: { type: String, enum: SUBJECT_COLORS, default: 'blue' },
    order: { type: Number, default: 0 },
    // Set when a term ends (a later batch); archived subjects don't count toward the cap.
    archivedAt: { type: Date, default: null },
    canvasCourseId: { type: String, default: null },
}, { timestamps: true });

subjectSchema.index({ owner: 1, archivedAt: 1, order: 1 });
subjectSchema.index(
    { owner: 1, canvasCourseId: 1 },
    { unique: true, partialFilterExpression: { canvasCourseId: { $type: 'string' } } },
);

export default mongoose.models.subject || mongoose.model('subject', subjectSchema);
