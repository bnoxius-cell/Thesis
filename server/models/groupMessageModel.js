import mongoose from 'mongoose';
import { entrySchema } from './scheduleModel.js';

// Everything a groupmate needs to save their own copy of a shared reviewer, answers included.
// Plain values without the sender's ids, and never the sender's notes (sourceText) or file names.
const reviewerContentSchema = new mongoose.Schema({
    source: {
        type: { type: String },
        count: Number,
        pages: Number,
        slides: Number,
        chars: Number,
        truncated: Boolean,
    },
    summary: String,
    keyPoints: [String],
    keyTerms: [{ _id: false, term: String, definition: String }],
    topics: [{ _id: false, name: String, summary: String }],
    questions: [{
        _id: false,
        topic: String,
        type: { type: String },
        prompt: String,
        options: [String],
        correctIndex: Number,
        answer: String,
        accepted: [String],
        items: [{ _id: false, answer: String, accepted: [String] }],
        points: [String],
        explanation: String,
        difficulty: String,
    }],
}, { _id: false });

// A class time of a shared subject. Dates are left out: the receiver's term is their own.
const classTimeSchema = new mongoose.Schema({
    days: [Number],
    startTime: String,
    endTime: String,
    location: String,
    meetingUrl: String,
}, { _id: false });

// The cards of a shared deck, text only: the receiver's copy starts with a fresh review schedule.
const deckContentSchema = new mongoose.Schema({
    cards: [{ _id: false, term: String, answer: String }],
}, { _id: false });

// One document per chat message. Kept out of the group document so a busy chat
// never bloats it, and so history can be paged by _id.
const groupMessageSchema = new mongoose.Schema({
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'group', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    type: { type: String, enum: ['text', 'task', 'schedule', 'reviewer', 'subject', 'deck', 'deleted'], default: 'text' },
    text: { type: String, default: '', maxlength: 1000 },
    // Snapshot of a shared task. shareTag is what a teammate imports from.
    task: {
        shareTag: { type: String, match: /^\d{6}$/ },
        title: String,
        course: String,
        description: String,
        dueDate: Date,
        hours: Number,
        difficulty: Number,
        importance: Number,
    },
    // Snapshot of a shared schedule (pictures left out). Teammates copy entries from this,
    // so later edits or deletion of the original never change what was shared.
    schedule: {
        title: String,
        ownerName: String,
        theme: String,
        entries: [entrySchema],
    },
    // What the chat card shows for a shared reviewer.
    reviewer: {
        title: String,
        course: String,
        questionCount: Number,
        questionType: String,
        // No default, so other messages don't carry an empty reviewer.
        topicNames: { type: [String], default: undefined },
        summary: String,
    },
    // Hidden from every query unless asked for, so answers never reach a message list. Only
    // saving a copy reads it.
    reviewerContent: { type: reviewerContentSchema, select: false },
    // What the chat card shows for a shared subject, and what a groupmate's copy is made from.
    subject: {
        name: String,
        code: String,
        term: String,
        color: String,
        classTimes: { type: [classTimeSchema], default: undefined },
    },
    // What the chat card shows for a shared deck. The cards stay out of every message list, like a reviewer's answers.
    deck: {
        title: String,
        course: String,
        cardCount: Number,
    },
    deckContent: { type: deckContentSchema, select: false },
    // Emoji -> ids of the members who used it. Insertion order is display order.
    reactions: { type: Map, of: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }], default: {} },
    // A deleted message stays as a tombstone so other clients' polls can see it go.
    deletedAt: { type: Date, default: null },
    deletedByAdmin: { type: Boolean, default: false },
}, { timestamps: true });

// Feeds the poll's change list (reactions and deletes on messages the client already has).
groupMessageSchema.index({ group: 1, updatedAt: 1 });

export default mongoose.models.groupMessage || mongoose.model('groupMessage', groupMessageSchema);
