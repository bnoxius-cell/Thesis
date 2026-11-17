import mongoose from 'mongoose';
import classChoiceModel from '../models/classChoiceModel.js';
import scheduleModel, { personalTimetables, MAX_ENTRIES } from '../models/scheduleModel.js';
import { SUBJECT_LIMITS } from '../models/subjectModel.js';
import { activeSubjects, courseKey, entrySubjectFor, matchesLabel } from './subjectMatch.js';
import { planNewSubject, createPlannedSubject, capMessage } from '../controllers/subjectController.js';
import { mainScheduleOrNew } from './mainTimetable.js';
import { memberIds, describeEntry, recordChangeUpdate } from './timetableChanges.js';

// A member's own layer over a timetable shared with them (plan 40, 2.4). Following a class is the default and
// stores nothing; "Not taking this" hides it from their week; "Customize mine" puts a real copy of it in their own
// main timetable and hides the shared one. Nothing here writes to the shared timetable, except `publishCopy`
// (an editor's own action).

const asId = (id) => new mongoose.Types.ObjectId(String(id));

// Everyone on a timetable has a layer except the owner of a personal timetable (it is already theirs). The group
// owner does, as a member who may be irregular too.
export const hasLayer = (schedule, role) => Boolean(role) && (role !== 'owner' || Boolean(schedule.group));

// What a customized class remembers of the shared one, to tell the member when it moved.
const BASE_FIELDS = ['days', 'date', 'startTime', 'endTime', 'location', 'meetingUrl'];

const baseOf = (entry) => ({
    days: [...(entry.days || [])],
    date: entry.date || '',
    startTime: entry.startTime,
    endTime: entry.endTime,
    location: entry.location || '',
    meetingUrl: entry.meetingUrl || '',
});

const sameBase = (entry, base) => BASE_FIELDS.every((key) => (key === 'days'
    ? (entry.days || []).join() === (base.days || []).join()
    : (entry[key] || '') === (base[key] || '')));

// Everything a copy takes from the shared class; its subject is the member's own.
const COPY_FIELDS = [
    'title', 'kind', 'days', 'date', 'startDate', 'endDate', 'startTime', 'endTime',
    'location', 'meetingUrl', 'notes', 'color', 'icon', 'image', 'skipOnHoliday', 'prepHours',
];

// Two classes are the same when they have the same name, kind and times: a customize retry reuses the copy.
const sameClass = (a, b) => a.title === b.title && a.kind === b.kind && (a.date || '') === (b.date || '')
    && (a.days || []).join() === (b.days || []).join() && a.startTime === b.startTime && a.endTime === b.endTime;

const sameClassFilter = (entry) => ({
    title: entry.title, kind: entry.kind, date: entry.date || '', days: entry.days || [], startTime: entry.startTime, endTime: entry.endTime,
});

// ---- Reading a member's layer --------------------------------------------------------------------------------

// The copies, among `docs`' customized classes, that are still in the member's own timetables, by entry id. A
// copy the member deleted (or that went with their subject) is gone, and its class then reads as hidden.
const liveCopies = async (userId, docs) => {
    const copies = docs.flatMap((doc) => doc.choices).filter((c) => c.choice === 'custom' && c.copy).map((c) => c.copy);
    if (!copies.length) return new Map();
    const schedules = await scheduleModel
        .find({ _id: { $in: copies.map((c) => c.schedule) }, ...personalTimetables(userId) })
        .select('entries._id entries.title')
        .lean();
    const found = new Map();
    schedules.forEach((s) => s.entries.forEach((e) => {
        found.set(String(e._id), { scheduleId: String(s._id), entryId: String(e._id), title: e.title });
    }));
    return found;
};

// The member's layer on each of `scheduleIds`, in one query (two with customized classes):
// Map scheduleId -> { setupAt, byEntry: Map entryId -> { myChoice: 'hidden' } or { myChoice: 'custom', base, copy } }.
export const choicesFor = async (userId, scheduleIds) => {
    const layers = new Map(scheduleIds.map((id) => [String(id), { setupAt: null, byEntry: new Map() }]));
    if (!scheduleIds.length) return layers;
    const docs = await classChoiceModel.find({ user: userId, schedule: { $in: scheduleIds } }).lean();
    const copies = await liveCopies(userId, docs);
    for (const doc of docs) {
        const layer = layers.get(String(doc.schedule));
        layer.setupAt = doc.setupAt ?? null;
        for (const c of doc.choices) {
            const copy = c.choice === 'custom' && c.copy ? copies.get(String(c.copy.entry)) : null;
            layer.byEntry.set(String(c.entry), copy ? { myChoice: 'custom', base: c.base, copy } : { myChoice: 'hidden' });
        }
    }
    return layers;
};

export const layerOf = async (userId, schedule) => (await choicesFor(userId, [schedule._id])).get(String(schedule._id));

// 'changed' when the shared class no longer matches what the member customized, 'removed' when it is gone,
// otherwise null. Only a customized class has notices.
export const noticeFor = (choice, entry) => {
    if (choice?.myChoice !== 'custom') return null;
    if (!entry) return 'removed';
    return sameBase(entry, choice.base) ? null : 'changed';
};

// The caller's `myChoice` and `notice` on one entry of a shared timetable.
export const entryLayer = (layer, entry) => {
    const choice = layer.byEntry.get(String(entry._id));
    return { myChoice: choice?.myChoice ?? 'follow', notice: noticeFor(choice, entry) };
};

const copyRef = (copy) => (copy ? { scheduleId: copy.scheduleId, entryId: copy.entryId } : null);

// What the member does differently on this timetable, for the group Plan tab: `setupAt`, and every class they
// don't simply follow, with its notice. A customized class the group removed is still listed (its notice is
// 'removed', its title the copy's); a hidden one that was removed is not.
export const myClassesOf = (schedule, layer) => {
    const entries = new Map(schedule.entries.map((e) => [String(e._id), e]));
    const classes = [...layer.byEntry].flatMap(([entryId, choice]) => {
        const entry = entries.get(entryId);
        if (!entry && choice.myChoice !== 'custom') return [];
        return [{
            entryId,
            title: entry?.title ?? choice.copy.title,
            myChoice: choice.myChoice,
            notice: noticeFor(choice, entry),
            copy: copyRef(choice.copy),
        }];
    });
    return { setupAt: layer.setupAt, classes };
};

export const myClassesFor = async (userId, schedule) => myClassesOf(schedule, await layerOf(userId, schedule));

const groupRef = (schedule) => (schedule.group ? { _id: schedule.group._id ?? schedule.group, name: schedule.group.name } : null);

// Resolves the layers into the week (countedSchedules): a shared timetable keeps only the classes the member
// follows, each marked as such (with its group), and a copy in the member's own timetable is marked as theirs,
// with its notice and the class it customizes. `schedules` are lean, with `role` and plain entries.
export const applyChoices = (schedules, layers) => {
    const copies = new Map();
    for (const schedule of schedules) {
        const layer = layers.get(String(schedule._id));
        if (!layer) continue;
        const group = groupRef(schedule);
        const entries = new Map(schedule.entries.map((e) => [String(e._id), e]));
        for (const [entryId, choice] of layer.byEntry) {
            if (choice.myChoice !== 'custom') continue;
            copies.set(choice.copy.entryId, {
                myChoice: 'custom',
                notice: noticeFor(choice, entries.get(entryId)),
                customOf: { scheduleId: String(schedule._id), entryId },
                ...(group && { group }),
            });
        }
        schedule.entries = schedule.entries
            .filter((entry) => !layer.byEntry.has(String(entry._id)))
            .map((entry) => ({ ...entry, layer: { myChoice: 'follow', notice: null, ...(group && { group }) } }));
    }
    if (!copies.size) return;
    for (const schedule of schedules) {
        if (layers.has(String(schedule._id))) continue;
        schedule.entries = schedule.entries.map((entry) => (copies.has(String(entry._id)) ? { ...entry, layer: copies.get(String(entry._id)) } : entry));
    }
};

// How many members use their own time for each class, for the people who edit the timetable. Counts only,
// never names (owner, Q10).
export const customCounts = async (scheduleId) => {
    const rows = await classChoiceModel.aggregate([
        { $match: { schedule: asId(scheduleId) } },
        { $unwind: '$choices' },
        { $match: { 'choices.choice': 'custom' } },
        { $group: { _id: '$choices.entry', n: { $sum: 1 } } },
    ]);
    return new Map(rows.map((r) => [String(r._id), r.n]));
};

// Who hears about a change to one class of a shared timetable (`entry` as it is after the change, or as it
// was when `removed`). Members who hid it hear nothing; members with their own copy get a line of their own,
// unless the class now matches what they customized; everyone else gets the usual line. Null when nobody
// made a choice on it (the usual audience).
export const changeAudience = async (schedule, entry, { removed = false } = {}) => {
    const docs = await classChoiceModel
        .find({ schedule: schedule._id, 'choices.entry': entry._id })
        .select('user choices')
        .lean();
    if (!docs.length) return null;

    const choices = docs.map((doc) => ({ user: String(doc.user), choice: doc.choices.find((c) => String(c.entry) === String(entry._id)) }));
    const copies = choices.filter(({ choice }) => choice.choice === 'custom' && choice.copy).map(({ choice }) => choice.copy);
    const kept = copies.length
        ? await scheduleModel.find({ _id: { $in: copies.map((c) => c.schedule) }, group: null }).select('owner entries._id').lean()
        : [];
    const hasCopy = (user, copy) => kept.some((s) => String(s._id) === String(copy.schedule) && String(s.owner) === user
        && s.entries.some((e) => String(e._id) === String(copy.entry)));

    const skipped = new Set(choices.map((c) => c.user));
    const customizers = choices
        .filter(({ user, choice }) => choice.choice === 'custom' && choice.copy && hasCopy(user, choice.copy))
        .filter(({ choice }) => removed || !sameBase(entry, choice.base))
        .map(({ user }) => user);
    return {
        followers: memberIds(schedule).filter((id) => !skipped.has(id)),
        customizers,
        customSummary: removed
            ? `removed ${describeEntry(entry)}. Yours is still in your timetable.`
            : `changed ${describeEntry(entry)} for everyone. Your own time for it stays as it is.`,
    };
};

// ---- Writing a member's layer ----------------------------------------------------------------------------------

// Rewrites the member's choices on one timetable in one atomic update, creating the document on first use:
// drops the choices for `replace` (entry ids) and any hidden choice for a class no longer in `liveIds`, then
// adds `add`. `setupAt` marks the join checklist as answered.
const writeChoices = async ({ scheduleId, userId, replace = [], add = [], liveIds, setupAt }) => {
    const dropped = replace.map(asId);
    const update = [{
        $set: {
            choices: {
                $concatArrays: [
                    {
                        $filter: {
                            input: { $ifNull: ['$choices', []] },
                            as: 'c',
                            cond: {
                                $and: [
                                    { $not: [{ $in: ['$$c.entry', dropped] }] },
                                    { $or: [{ $eq: ['$$c.choice', 'custom'] }, { $in: ['$$c.entry', liveIds.map(asId)] }] },
                                ],
                            },
                        },
                    },
                    { $literal: add },
                ],
            },
            setupAt: setupAt ? { $literal: setupAt } : { $ifNull: ['$setupAt', null] },
        },
    }];
    const filter = { schedule: asId(scheduleId), user: asId(userId) };
    try {
        await classChoiceModel.updateOne(filter, update, { upsert: true, updatePipeline: true });
    } catch (error) {
        // Two first writes at once: one made the document, so the other updates it.
        if (error.code !== 11000) throw error;
        await classChoiceModel.updateOne(filter, update, { updatePipeline: true });
    }
};

const entryIdsOf = (schedule) => schedule.entries.map((e) => String(e._id));

// Removes the member's own copy of a class from their timetable (a live one logs it).
const removeCopy = async (userId, copy) => {
    const filter = { _id: copy.scheduleId, ...personalTimetables(userId) };
    const timetable = await scheduleModel.findOne({ ...filter, 'entries._id': copy.entryId }).lean();
    if (!timetable) return;
    const entry = timetable.entries.find((e) => String(e._id) === copy.entryId);
    const { push, announce } = await recordChangeUpdate(timetable, userId, `removed ${describeEntry(entry)}`);
    // The pull shifts entry positions, so it bumps the version (as removeClassTimes does).
    await scheduleModel.updateOne(filter, { $pull: { entries: { _id: asId(copy.entryId) } }, $inc: { __v: 1 }, ...push });
    await announce();
};

// "I take this" (follow) or "Not taking this" (hidden). Following a class the member customized ("Use the
// group's", or "Remove mine" once the group removed it) deletes their copy.
export const setChoice = async (userId, schedule, layer, entryId, choice) => {
    const current = layer.byEntry.get(entryId);
    if (choice === 'follow' && current?.myChoice === 'custom') await removeCopy(userId, current.copy);
    await writeChoices({
        scheduleId: schedule._id, userId, replace: [entryId], liveIds: entryIdsOf(schedule),
        add: choice === 'hidden' ? [{ entry: asId(entryId), choice: 'hidden', copy: null, base: null }] : [],
    });
};

// The join checklist: every class not in `taking` is hidden, a hidden class in it is followed again, and a
// customized class the member still takes stays theirs. Other kinds of entries keep their choices.
export const setUp = async (userId, schedule, layer, taking) => {
    const classIds = schedule.entries.filter((e) => e.kind === 'class').map((e) => String(e._id));
    const keep = new Set(classIds.filter((id) => taking.has(id) && layer.byEntry.get(id)?.myChoice === 'custom'));
    await writeChoices({
        scheduleId: schedule._id, userId, liveIds: entryIdsOf(schedule), setupAt: new Date(),
        replace: classIds.filter((id) => !keep.has(id)),
        add: classIds.filter((id) => !taking.has(id)).map((id) => ({ entry: asId(id), choice: 'hidden', copy: null, base: null })),
    });
};

// "Keep mine": the notice goes away. On a class that moved, the member's copy now counts as customized from the
// class as it is; on a class the group removed, the choice is dropped and the copy stays a plain class of theirs.
export const keepMine = async (userId, schedule, layer, entryId) => {
    const current = layer.byEntry.get(entryId);
    const entry = schedule.entries.find((e) => String(e._id) === entryId);
    await writeChoices({
        scheduleId: schedule._id, userId, replace: [entryId], liveIds: entryIdsOf(schedule),
        add: entry ? [{ entry: asId(entryId), choice: 'custom', copy: { schedule: asId(current.copy.scheduleId), entry: asId(current.copy.entryId) }, base: baseOf(entry) }] : [],
    });
};

// The member's subjects for the classes about to be copied: an existing one of the same name or code, or a new
// one (plan 34 rule 1). All new names are checked, and the cap of 30 counted, before any is created, so a
// refusal creates nothing. Returns { subjects } (the member's active subjects, new ones included) or { error }.
const subjectsForCopies = async (userId, entries) => {
    const subjects = await activeSubjects(userId).lean();
    const planned = new Map();
    for (const entry of entries) {
        if (entry.kind !== 'class' || subjects.some((s) => matchesLabel(s, entry.title))) continue;
        const key = courseKey(entry.title);
        if (planned.has(key)) continue;
        const plan = await planNewSubject(userId, entry.title);
        if (plan.error) return { error: plan.error };
        planned.set(key, plan);
    }
    if (subjects.length + planned.size > SUBJECT_LIMITS.maxActive) return { error: capMessage() };
    for (const plan of planned.values()) {
        subjects.push(await createPlannedSubject(userId, { name: plan.name, subjects }));
    }
    return { subjects };
};

// The member's own copy of a shared class: a class titled with their subject's name and linked to it.
const copyOf = (entry, subjects) => {
    const subject = entrySubjectFor(entry, subjects);
    const fields = Object.fromEntries(COPY_FIELDS.filter((key) => entry[key] !== undefined).map((key) => [key, entry[key]]));
    return {
        ...fields,
        ...(entry.kind === 'class' && subject && { title: subject.name }),
        subject: subject ? subject._id : null,
    };
};

const COPY_TRIES = 3;
const ENTRY_CAP = `A schedule can hold up to ${MAX_ENTRIES} entries.`;

// Puts copies of `entries` into the member's main timetable in one write, reusing a class that is already there
// (a retry makes no second copy), and returns each new copy's id by shared entry id, or { error }. The write
// only lands while the timetable has room and none of the new classes is in it yet; otherwise it reads again.
const placeCopies = async (userId, copies) => {
    for (let attempt = 0; attempt < COPY_TRIES; attempt += 1) {
        const main = await mainScheduleOrNew(userId);
        const placed = new Map();
        const fresh = [];
        for (const [entryId, copy] of copies) {
            const existing = main.entries.find((e) => sameClass(e, copy));
            if (existing) {
                placed.set(entryId, String(existing._id));
            } else {
                const _id = new mongoose.Types.ObjectId();
                fresh.push({ ...copy, _id });
                placed.set(entryId, String(_id));
            }
        }
        if (main.entries.length + fresh.length > MAX_ENTRIES) return { error: ENTRY_CAP };
        if (!fresh.length) return { scheduleId: String(main._id), placed };

        const added = fresh.length === 1 ? describeEntry(fresh[0]) : `${fresh.length} classes`;
        const { push, announce } = await recordChangeUpdate(main, userId, `added ${added}`);
        const { matchedCount } = await scheduleModel.updateOne(
            {
                _id: main._id,
                ...personalTimetables(userId),
                [`entries.${MAX_ENTRIES - fresh.length}`]: { $exists: false },
                $nor: fresh.map((copy) => ({ entries: { $elemMatch: sameClassFilter(copy) } })),
            },
            { $push: { entries: { $each: fresh }, ...push.$push } },
        );
        if (matchedCount === 1) {
            await announce();
            return { scheduleId: String(main._id), placed };
        }
    }
    return { error: 'Your timetable changed while this was saving. Try again.' };
};

// "Customize mine" (one class) or "Make it all mine" (several): copies the classes into the member's own main
// timetable, linked to their subjects, and marks them customized. Returns { scheduleId, placed } (copy entry id
// by shared entry id) or { error } with nothing written.
export const customizeClasses = async (userId, schedule, entries) => {
    const { subjects, error } = await subjectsForCopies(userId, entries);
    if (error) return { error };
    const result = await placeCopies(userId, new Map(entries.map((e) => [String(e._id), copyOf(e, subjects)])));
    if (result.error) return result;
    await writeChoices({
        scheduleId: schedule._id, userId, replace: [...result.placed.keys()], liveIds: entryIdsOf(schedule),
        add: entries.map((e) => ({
            entry: asId(e._id),
            choice: 'custom',
            copy: { schedule: asId(result.scheduleId), entry: asId(result.placed.get(String(e._id))) },
            base: baseOf(e),
        })),
    });
    return result;
};

// An editor's "Publish my version": their copy's days, date, times, place and link become the shared class's,
// only while the shared class still is what they customized. Then the copy and the choice go, so they follow
// the class again. Returns { conflict: true } when the class moved meanwhile.
export const publishCopy = async (userId, schedule, layer, entryId) => {
    const choice = layer.byEntry.get(entryId);
    const timetable = await scheduleModel.findOne({ _id: choice.copy.scheduleId, ...personalTimetables(userId) }).select('entries').lean();
    const copy = timetable?.entries.find((e) => String(e._id) === choice.copy.entryId);
    if (!copy) return { conflict: true };
    const shared = schedule.entries.find((e) => String(e._id) === entryId);
    const values = baseOf(copy);
    const after = { ...shared, ...values };

    const audience = await changeAudience(schedule, after);
    const { push, announce } = await recordChangeUpdate(schedule, userId, `edited ${describeEntry(shared)}`, { audience });
    const { matchedCount } = await scheduleModel.updateOne(
        { _id: schedule._id, entries: { $elemMatch: { _id: asId(entryId), ...choice.base } } },
        { $set: Object.fromEntries(BASE_FIELDS.map((key) => [`entries.$[e].${key}`, values[key]])), ...push },
        { arrayFilters: [{ 'e._id': asId(entryId) }] },
    );
    if (matchedCount !== 1) return { conflict: true };
    await announce();
    await removeCopy(userId, choice.copy);
    await writeChoices({ scheduleId: schedule._id, userId, replace: [entryId], liveIds: entryIdsOf(schedule) });
    return { conflict: false };
};

// ---- Leaving -----------------------------------------------------------------------------------------------------

// A member is off a timetable (left, removed, or it went private): their choices go. Copies stay as their own classes.
export const forgetChoices = (scheduleId, userId) => classChoiceModel.deleteMany({ schedule: scheduleId, ...(userId && { user: userId }) });

// The same for a member leaving or removed from a group, on the group's timetable.
export const forgetGroupChoices = async (groupId, userId) => {
    const timetable = await scheduleModel.findOne({ group: groupId }).select('_id').lean();
    if (timetable) await forgetChoices(timetable._id, userId);
};

// Timetables being deleted take everyone's choices on them along.
export const forgetTimetables = (scheduleIds) => classChoiceModel.deleteMany({ schedule: { $in: scheduleIds } });
