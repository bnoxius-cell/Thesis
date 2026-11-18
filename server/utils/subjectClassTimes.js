import mongoose from 'mongoose';
import scheduleModel, { personalTimetables, MAX_ENTRIES } from '../models/scheduleModel.js';
import { closeProposals } from '../models/classProposalModel.js';
import { describeEntry, recordChangeUpdate } from './timetableChanges.js';
import { entrySubjectFor } from './subjectMatch.js';
import { ensureMainSchedule, mainScheduleOrNew } from './mainTimetable.js';

const asId = (id) => new mongoose.Types.ObjectId(String(id));
const linkedClass = (subjectId) => ({ subject: asId(subjectId), kind: 'class' });

// Each write is one atomic update of one of the caller's personal timetables (`personalTimetables` is always in
// the filter, so a timetable shared with the caller, or a group timetable they own as the group's owner, is never
// touched), so a concurrent edit can't fail it.

// A subject was created: the owner's unlinked classes with its name or code take the link, so counts, rename
// and delete reach them. Classes that already have a subject are left alone. Returns how many were linked.
export const linkClassTimes = async (ownerId, subject) => {
    const schedules = await scheduleModel.find({
        ...personalTimetables(ownerId),
        entries: { $elemMatch: { kind: 'class', subject: null } },
    }).select('entries').lean();
    let linked = 0;
    for (const schedule of schedules) {
        const ids = schedule.entries
            .filter((e) => e.kind === 'class' && !e.subject && entrySubjectFor(e, [subject]))
            .map((e) => e._id);
        if (!ids.length) continue;
        // The copy from before the update shows which of these classes this request really linked: a class that
        // another request linked in between was no longer unlinked, so it isn't counted here.
        const before = await scheduleModel.findOneAndUpdate(
            { _id: schedule._id, ...personalTimetables(ownerId) },
            { $set: { 'entries.$[e].subject': asId(subject._id) } },
            { arrayFilters: [{ 'e._id': { $in: ids }, 'e.kind': 'class', 'e.subject': null }], returnDocument: 'before' },
        ).select('entries').lean();
        if (!before) continue; // deleted since it was read
        const wanted = new Set(ids.map(String));
        linked += before.entries.filter((e) => wanted.has(String(e._id)) && !e.subject).length;
    }
    return linked;
};

// A subject was renamed: its classes take the new name. Exams keep their titles. A live timetable logs one
// line. Safe to run again: it only picks timetables that still have a class under another name.
// Returns how many timetables failed (logged), so the caller can finish the rest of the rename first.
export const renameClassTimes = async (ownerId, subject) => {
    const stale = await scheduleModel.find({
        ...personalTimetables(ownerId),
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
                { _id: schedule._id, ...personalTimetables(ownerId) },
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

// A subject was deleted or archived: its exams stay and lose the link. Throws on a failure, and a retry carries on.
export const unlinkExams = (ownerId, subjectId) => scheduleModel.updateMany(
    { ...personalTimetables(ownerId), entries: { $elemMatch: { subject: asId(subjectId), kind: { $ne: 'class' } } } },
    { $set: { 'entries.$[e].subject': null } },
    { arrayFilters: [{ 'e.subject': asId(subjectId), 'e.kind': { $ne: 'class' } }] },
);

const isClassOf = (subjectId) => (e) => e.kind === 'class' && String(e.subject) === String(subjectId);

// The subject's classes in the owner's personal timetables.
export const classEntriesOf = async (ownerId, subjectId) => {
    const schedules = await scheduleModel.find({ ...personalTimetables(ownerId), entries: { $elemMatch: linkedClass(subjectId) } }).select('entries').lean();
    return schedules.flatMap((s) => s.entries.filter(isClassOf(subjectId)));
};

// A subject was deleted or archived: its classes are removed (a live timetable logs one line), and friends' open
// proposals on them close. Throws on a failure, and a retry carries on. Returns how many class times were removed.
export const pullClassTimes = async (ownerId, subjectId) => {
    let removed = 0;
    const schedules = await scheduleModel.find({ ...personalTimetables(ownerId), entries: { $elemMatch: linkedClass(subjectId) } }).lean();
    for (const schedule of schedules) {
        const titles = schedule.entries.filter(isClassOf(subjectId)).map(describeEntry);
        const { push, announce } = await recordChangeUpdate(schedule, ownerId, `removed ${titles.join(', ')}`);
        // The pull shifts entry positions, so it bumps the version: a save from a copy loaded before it (which
        // writes entries by position) then fails instead of landing on the wrong entry.
        const before = await scheduleModel.findOneAndUpdate(
            { _id: schedule._id, ...personalTimetables(ownerId) },
            { $pull: { entries: linkedClass(subjectId) }, $inc: { __v: 1 }, ...push },
            { returnDocument: 'before' },
        ).lean();
        if (!before) continue; // deleted since it was read
        const pulledIds = before.entries.filter(isClassOf(subjectId)).map((e) => e._id);
        removed += pulledIds.length;
        await closeProposals({ schedule: schedule._id, entry: { $in: pulledIds } });
        await announce();
    }
    return removed;
};

// A subject was deleted: its classes go and its exams stay, without the link. Returns how many class times were removed.
export const removeClassTimes = async (ownerId, subjectId) => {
    await unlinkExams(ownerId, subjectId);
    return pullClassTimes(ownerId, subjectId);
};

// ---- Adding class times to the main timetable ----------------------------------------------------------------

// A class time is the same as another when it falls on the same days (in any order) or date, at the same times.
export const classTimeKey = (entry) => [
    [...(entry.days ?? [])].sort((a, b) => a - b).join(','), entry.date || '', entry.startTime, entry.endTime,
].join('|');

const sameClassTime = (entry) => ({
    $elemMatch: {
        kind: 'class',
        subject: entry.subject,
        startTime: entry.startTime,
        endTime: entry.endTime,
        date: entry.date || '',
        days: entry.days.length ? { $all: entry.days, $size: entry.days.length } : { $size: 0 },
    },
});

const ENTRY_CAP = `A schedule can hold up to ${MAX_ENTRIES} entries.`;
const WRITE_TRIES = 3;

// The owner's main timetable as it is now, or null when they have none yet.
const readMain = async (ownerId) => {
    const id = await ensureMainSchedule(ownerId);
    return id ? scheduleModel.findById(id).lean() : null;
};

// Checks, without writing, that `classes` (class entries, each with a `subject` that only has to tell subjects
// apart) fit in the owner's main timetable once the classes of the subjects in `dropping` have left it. Returns
// { fresh, skipped, main } (`skipped` counts classes the timetable already has) or { error, full: true }.
export const planClassTimes = async (ownerId, classes, { dropping = [] } = {}) => {
    const main = await readMain(ownerId);
    const leaving = new Set(dropping.map(String));
    const staying = (main?.entries ?? []).filter((e) => !(e.kind === 'class' && leaving.has(String(e.subject))));
    const seen = new Set(staying.filter((e) => e.kind === 'class' && e.subject).map((e) => `${e.subject}|${classTimeKey(e)}`));
    const fresh = classes.filter((c) => {
        const key = `${c.subject}|${classTimeKey(c)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    if (staying.length + fresh.length > MAX_ENTRIES) return { error: ENTRY_CAP, full: true };
    return { fresh, skipped: classes.length - fresh.length, main };
};

// Adds linked class entries to the owner's main timetable in one atomic push, skipping class times it already
// has, so a retry adds nothing twice. The push only lands while the timetable has room and none of the new class
// times is in it yet; otherwise it plans again. Returns { added, skipped }, or { error } (plus `full` when the
// timetable has no room), in which case nothing was written.
export const addClassTimes = async (ownerId, classes) => {
    if (!classes.length) return { added: 0, skipped: 0 };
    for (let attempt = 0; attempt < WRITE_TRIES; attempt += 1) {
        const { fresh, skipped, main: existing, ...refused } = await planClassTimes(ownerId, classes);
        if (refused.error) return refused;
        if (!fresh.length) return { added: 0, skipped };

        const main = existing ?? (await mainScheduleOrNew(ownerId)).toObject();
        const { push, announce } = await recordChangeUpdate(main, ownerId, fresh.length === 1 ? `added ${describeEntry(fresh[0])}` : `added ${fresh.length} class times`);
        const { matchedCount } = await scheduleModel.updateOne(
            {
                _id: main._id,
                ...personalTimetables(ownerId),
                [`entries.${MAX_ENTRIES - fresh.length}`]: { $exists: false },
                $nor: fresh.map((entry) => ({ entries: sameClassTime(entry) })),
            },
            { $push: { entries: { $each: fresh }, ...push.$push } },
        );
        if (matchedCount === 1) {
            await announce();
            return { added: fresh.length, skipped };
        }
    }
    return { error: 'Your timetable changed while this was saving. Try again.' };
};
