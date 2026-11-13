import mongoose from 'mongoose';

export const FLASHCARD_LIMITS = {
    decks: 50,
    cardsPerDeck: 200,
    cardsPerUser: 2000,
    title: 120,
    term: 400,
    answer: 1000,
    reviewBatch: 50,
    importBatch: 200,
};

// A set of flashcards. One made from a reviewer is a copy of its key terms: `reviewer` only says
// where it came from (and keeps a second copy from being made), so deleting the reviewer leaves
// the deck alone. `course` is the display label, as on tasks and reviewers.
const flashcardDeckSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: FLASHCARD_LIMITS.title },
    course: { type: String, default: '', maxlength: 80 },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'subject', default: null },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'reviewer', default: null },
}, { timestamps: true });

flashcardDeckSchema.index({ owner: 1, createdAt: -1 });
// One deck per reviewer, even when two requests arrive at once.
flashcardDeckSchema.index({ owner: 1, reviewer: 1 }, { unique: true, partialFilterExpression: { reviewer: { $type: 'objectId' } } });

export default mongoose.models.flashcardDeck || mongoose.model('flashcardDeck', flashcardDeckSchema);
