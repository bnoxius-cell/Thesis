// Sharing a subject in a group chat: the snapshot posted with the message, and what a groupmate gets when
// they add it. The snapshot is plain values (no notes, no ids), so the sender's later edits never change it.
import mongoose from 'mongoose';
import subjectModel from '../models/subjectModel.js';
import { refusal } from './httpErrors.js';
import { classEntriesOf, classTimeKey, addClassTimes, pullClassTimes } from './subjectClassTimes.js';
import { readClassTimes, MAX_CLASS_TIMES } from './newTerm.js';
import { planNewSubject, createPlannedSubject } from '../controllers/subjectController.js';

// The sender's recurring class times for the subject, once each. A one-off dated class has no weekday to repeat
// on, and a subject can't carry more than `MAX_CLASS_TIMES` times, so the card holds the first few.
const sharedClassTimes = (entries) => {
    const byKey = new Map();
    for (const entry of entries) {
        if (entry.days.length && !byKey.has(classTimeKey(entry))) byKey.set(classTimeKey(entry), entry);
    }
    return [...byKey.values()]
        .slice(0, MAX_CLASS_TIMES)
        .map(({ days, startTime, endTime, location, meetingUrl }) => ({ days, startTime, endTime, location, meetingUrl }));
};

export const subjectSnapshot = async (subject) => ({
    subject: {
        name: subject.name,
        code: subject.code,
        term: subject.term,
        color: subject.color,
        classTimes: sharedClassTimes(await classEntriesOf(subject.owner, subject._id)),
    },
});

// Every piece of text a shared subject puts in front of the group, for the family-friendly filter.
export const subjectTexts = ({ subject }) => [
    subject.name, subject.code, subject.term, ...subject.classTimes.map((t) => t.location),
];

// Adds a shared subject for `userId`: their subject with that name or code (reused) or a new one, plus the class
// times it doesn't have yet in their main timetable. Answers what was added, null when they already added it from
// this message, or { error, status } with nothing written.
export const saveSubject = async (message, userId) => {
    const token = `message:${message._id}`;
    if (await subjectModel.exists({ owner: userId, importedFrom: token })) return null;

    const { name, code, term, classTimes } = message.subject;
    const plan = await planNewSubject(userId, name, code);
    if (plan.error) return refusal(plan.error);
    const existing = plan.subject;
    const times = readClassTimes(existing?.name ?? plan.name, classTimes);
    if (times.error) return refusal(times.error, times.status);

    const _id = existing?._id ?? new mongoose.Types.ObjectId();
    const placed = await addClassTimes(userId, times.classTimes.map((time) => ({ ...time, subject: _id })));
    if (placed.error) return refusal(placed.error, placed.full ? 400 : 409);

    try {
        if (existing) {
            const claimed = await subjectModel.updateOne({ _id, importedFrom: { $ne: token } }, { $addToSet: { importedFrom: token } });
            if (!claimed.matchedCount) return null; // a save that arrived at the same moment won
        } else {
            await createPlannedSubject(userId, plan, { _id, term, importedFrom: [token] });
        }
    } catch (error) {
        // Nothing made the subject, so its class times go again, as when a new subject fails to save.
        if (!existing && placed.added) await pullClassTimes(userId, _id).catch((pullError) => console.error('saveSubject rollback error:', pullError));
        // The unique index on (owner, importedFrom): a save that arrived at the same moment won.
        if (error.code === 11000) return null;
        throw error;
    }
    return { type: 'subject', _id, title: existing?.name ?? plan.name, classTimesAdded: placed.added };
};
