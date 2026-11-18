import mongoose from 'mongoose';
import { baseSchema } from './classChoiceModel.js';

// A member who can't edit a shared timetable proposes the time they customized to the people who can (plan 40,
// 2.5). `fields` are the values they propose, `base` the shared class's values when they customized it: approving
// only applies while the class still matches `base`.
//   open       waiting for an editor
//   approved   applied to the shared class; the proposer follows it again
//   declined   an editor said no; the proposer keeps their own copy
//   withdrawn  the proposer took it back, or it closed because the class or the proposer left the timetable
const classProposalSchema = new mongoose.Schema({
    schedule: { type: mongoose.Schema.Types.ObjectId, ref: 'schedule', required: true },
    entry: { type: mongoose.Schema.Types.ObjectId, required: true },
    // The class's title when proposed, so the list and the inbox lines still read right once the class is gone.
    title: { type: String, required: true },
    proposer: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    fields: { type: baseSchema, required: true },
    base: { type: baseSchema, required: true },
    status: { type: String, enum: ['open', 'approved', 'declined', 'withdrawn'], default: 'open' },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
    decidedAt: { type: Date, default: null },
}, { timestamps: true });

classProposalSchema.index({ schedule: 1, status: 1 });
// One open proposal per member per class.
classProposalSchema.index(
    { schedule: 1, entry: 1, proposer: 1 },
    { unique: true, partialFilterExpression: { status: 'open' } },
);

export default mongoose.models.classProposal || mongoose.model('classProposal', classProposalSchema);
