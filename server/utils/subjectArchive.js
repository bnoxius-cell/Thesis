import subjectModel, { MAX_PAST_CLASS_TIMES, SUBJECT_LIMITS } from '../models/subjectModel.js';
import { pickClassTime } from './entryFields.js';
import { refusal } from './httpErrors.js';
import { activeSubjects, sameNameTaken } from './subjectMatch.js';
import { addClassTimes, classEntriesOf, classTimeKey, pullClassTimes } from './subjectClassTimes.js';

// Archiving ends a subject for a term without losing it: its tasks, reviewers, decks and files keep pointing at
// it, its exams stay in the timetable, and only its class times leave (they are kept on the subject, so restoring
// it puts them back). Every function answers { error, status } (`refusal`) when it refuses, and writes nothing then.

// What archiving would store: the class times already kept plus any still in the owner's timetables, without
// repeats. Reads only.
export const planArchive = async (ownerId, subject) => {
    const times = [...subject.pastClassTimes, ...await classEntriesOf(ownerId, subject._id)].map(pickClassTime);
    const pastClassTimes = [...new Map(times.map((time) => [classTimeKey(time), time])).values()];
    if (pastClassTimes.length > MAX_PAST_CLASS_TIMES) {
        return refusal(`${subject.name} has more than ${MAX_PAST_CLASS_TIMES} class times. Delete some of them first.`);
    }
    return { pastClassTimes };
};

// Archives a subject of the owner's, or runs the end of an archive again (a retry after a failure, or class
// times that arrived since). The class times are saved on the subject first, then pulled, so a failure between
// the two loses nothing. Returns { subject } as it is now.
export const archiveSubject = async (ownerId, subject) => {
    const plan = await planArchive(ownerId, subject);
    if (plan.error) return plan;
    // Nothing new to keep means a repeat (the pull below still runs, in case an earlier one failed).
    const nothingNew = subject.archivedAt && plan.pastClassTimes.length === subject.pastClassTimes.length;
    const archived = nothingNew ? subject : await subjectModel.findOneAndUpdate(
        { _id: subject._id, owner: ownerId },
        { $set: { pastClassTimes: plan.pastClassTimes, archivedAt: subject.archivedAt ?? new Date() } },
        { returnDocument: 'after' },
    );
    if (!archived) return refusal('Subject not found', 404);
    await pullClassTimes(ownerId, subject._id);
    return { subject: archived };
};

const asClass = (time, subject) => ({ ...time, title: subject.name, kind: 'class', subject: subject._id, skipOnHoliday: true });

// Brings an archived subject back and puts its class times in the main timetable, linked. A timetable with no
// room doesn't stop the restore: the subject returns without them (`timetableFull`). Returns
// { subject, classTimesAdded, skipped, timetableFull }.
export const restoreSubject = async (ownerId, subject) => {
    if (!subject.archivedAt) return refusal('That subject is not archived.');
    const clash = await sameNameTaken(ownerId, subject.name);
    if (clash) return refusal(`You already have an active subject called ${clash.name}. Rename one first.`, 409);
    if ((await activeSubjects(ownerId)).length >= SUBJECT_LIMITS.maxActive) {
        return refusal(`You can have up to ${SUBJECT_LIMITS.maxActive} subjects. Archive or delete one first.`);
    }

    // The class times go in before the subject returns, so a failure in between is finished by restoring again.
    const placed = await addClassTimes(ownerId, subject.pastClassTimes.map((time) => asClass(pickClassTime(time), subject)));
    if (placed.error && !placed.full) return refusal(placed.error, 409);
    const restored = await subjectModel.findOneAndUpdate(
        { _id: subject._id, owner: ownerId },
        { $set: { archivedAt: null, pastClassTimes: [] } },
        { returnDocument: 'after' },
    );
    if (!restored) return refusal('Subject not found', 404);
    return { subject: restored, classTimesAdded: placed.added ?? 0, skipped: placed.skipped ?? 0, timetableFull: Boolean(placed.full) };
};
