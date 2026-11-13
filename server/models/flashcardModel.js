import mongoose from 'mongoose';
import { FLASHCARD_LIMITS } from './flashcardDeckModel.js';

// One card. `box` (0 to 5) and `dueAt` are the review schedule: they only change through
// utils/flashcardSchedule.js and are never sent to a browser or read from a request.
const flashcardSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    deck: { type: mongoose.Schema.Types.ObjectId, ref: 'flashcardDeck', required: true },
    term: { type: String, required: true, trim: true, minlength: 1, maxlength: FLASHCARD_LIMITS.term },
    answer: { type: String, required: true, trim: true, minlength: 1, maxlength: FLASHCARD_LIMITS.answer },
    box: { type: Number, min: 0, max: 5, default: 0 },
    dueAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviews: { type: Number, default: 0 },
    lapses: { type: Number, default: 0 },
}, { timestamps: true });

flashcardSchema.index({ owner: 1, dueAt: 1 });
flashcardSchema.index({ deck: 1, createdAt: 1 });

export default mongoose.models.flashcard || mongoose.model('flashcard', flashcardSchema);
