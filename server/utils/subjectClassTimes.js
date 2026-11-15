import mongoose from 'mongoose';
import scheduleModel from '../models/scheduleModel.js';
import { describeEntry, recordChangeUpdate } from './timetableChanges.js';
import { entrySubjectFor } from './subjectMatch.js';

const asId = (id) => new mongoose.Types.ObjectId(String(id));
const linkedClass = (subjectId) => ({ subject: asId(subjectId), kind: 'class' });

// Each write is one atomic update of one timetable the caller owns (`owner` is always in the filter, so a
// timetable shared with the caller is never touched), so a concurrent edit can't fail it.

// A subject was created: the owner's unlinked classes with its name or code take the link, so counts, rename
// and delete reach them. Classes that already have a subject are left alone. Returns how many were linked.
export const linkClassTimes = async (ownerId, subject) => {
    const schedules = await scheduleModel.find({
        owner: ownerId,
        entries: { $elemMatch: { kind: 'class', subject: null } },
    }).select('entries').lean();
    let linked = 0;
    for (const schedule of schedules) {
        const ids = schedule.entries
            .filter((e) => e.kind === 'class' && !e.subject && entrySubjectFor(e, [subject]))
            .map((e) => e._id);
        if (!ids.length) continue;
        const { modifiedCount } = await scheduleModel.updateOne(
            { _id: schedule._id, owner: ownerId },
            { $set: { 'entries.$[e].subject': asId(subject._id) } },
            { arrayFilters: [{ 'e._id': { $in: ids }, 'e.subject': null }] },
        );
        if (modifiedCount) linked += ids.length;
    }
    return linked;
};

// A subject was renamed: its classes take the new name. Exams keep their titles. A live timetable logs one
// line. Safe to run again: it only picks timetables that still have a class under another name.
// Returns how many timetables failed (logged), so the caller can finish the rest of the rename first.
export const renameClassTimes = async (ownerId, subject) => {
    const stale = await scheduleModel.find({
        owner: ownerId,
        entries: { $elemMatch: { ...linkedClass(subject._id), title: { $ne: subject.name } } },
    }).lean();
    let failed = 0;
    for (const schedule of stale) {
        try {
            const oldTitles = [...new Set(schedule.entries
                .filter((e) => e.kind === 'class' && String(e.subject) === String(subject._id) && e.title !== subject.name)
                .map(describeEntry))];
            const { push, announce } = await recordChangeUpdate(schedule, ownerId, `renamed ${oldTitles.join(', ')} to "${subject.name}"`);
            await scheduleModel.updateOne(
                { _id: schedule._id, owner: ownerId },
                { $set: { 'entries.$[e].title': subject.name }, ...push },
                { arrayFilters: [{ 'e.subject': asId(subject._id), 'e.kind': 'class' }] },
            );
            await announce();
        } catch (error) {
            failed += 1;
            console.error('renameClassTimes error', error);
        }
    }
    return failed;
};

// A subject was deleted: its classes are removed (a live timetable logs one line), its exams stay and lose
// the link. Throws on a failure, and a retry carries on. Returns how many class times were removed.
export const removeClassTimes = async (ownerId, subjectId) => {
    let removed = 0;
    for (const schedule of await scheduleModel.find({ owner: ownerId, 'entries.subject': asId(subjectId) }).lean()) {
        // $set on the exams and $pull on the classes can't share one update (both touch `entries`).
        await scheduleModel.updateOne(
            { _id: schedule._id, owner: ownerId },
            { $set: { 'entries.$[e].subject': null } },
            { arrayFilters: [{ 'e.subject': asId(subjectId), 'e.kind': { $ne: 'class' } }] },
        );
        const titles = schedule.entries.filter((e) => e.kind === 'class' && String(e.subject) === String(subjectId)).map(describeEntry);
        if (!titles.length) continue;
        const { push, announce } = await recordChangeUpdate(schedule, ownerId, `removed ${titles.join(', ')}`);
        // The pull shifts entry positions, so it bumps the version: a save from a copy loaded before it (which
        // writes entries by position) then fails instead of landing on the wrong entry.
        const before = await scheduleModel.findOneAndUpdate(
            { _id: schedule._id, owner: ownerId },
            { $pull: { entries: linkedClass(subjectId) }, $inc: { __v: 1 }, ...push },
            { returnDocument: 'before' },
        ).lean();
        if (!before) continue; // deleted since it was read
        removed += before.entries.filter((e) => e.kind === 'class' && String(e.subject) === String(subjectId)).length;
        await announce();
    }
    return removed;
};
