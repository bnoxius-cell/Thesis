import crypto from 'crypto';
import mongoose from 'mongoose';
import scheduleModel, {
    SCHEDULE_THEMES, MAX_ENTRIES, MAX_OWNED_SCHEDULES, ENTRY_KINDS, HOLIDAY_COUNTRY,
    personalTimetables,
} from '../models/scheduleModel.js';
import Friend from '../models/Friend.js';
import { notify } from '../utils/notify.js';
import userModel from '../models/userModel.js';
import subjectModel from '../models/subjectModel.js';
import classChoiceModel from '../models/classChoiceModel.js';
import { fetchPublicHolidays } from '../utils/holidays.js';
import { buildWeekOverview, addDaysIso, findUpcomingExams } from '../utils/weekOverview.js';
import groupModel from '../models/groupMode.js';
import groupMessageModel from '../models/groupMessageModel.js';
import { timetableLink } from '../utils/appLinks.js';
import { isLive, recordChange, describeEntry } from '../utils/timetableChanges.js';
import { isId, isStaleSave, serverError } from '../utils/httpErrors.js';
import { activeSubjects, entrySubjectFor, resolveItemSubject } from '../utils/subjectMatch.js';
import { withViewerSubjects } from '../utils/entrySubjects.js';
import { cleanEntry, isRealDate, pickClassTime } from '../utils/entryFields.js';
import { planNewSubject, createPlannedSubject, publicSubject } from './subjectController.js';
import { ensureMainSchedule, mainScheduleOrNew } from '../utils/mainTimetable.js';
import {
    hasLayer, choicesFor, layerOf, entryLayer, myClassesOf, applyChoices, customCounts, changeAudience,
    forgetChoices, forgetTimetables,
} from '../utils/classChoices.js';

// A save that lost a race with another edit answers 409 so the page can reload, not a generic 500.
const scheduleError = (res, label, error) => {
    if (!isStaleSave(error)) return serverError(res, label, error);
    console.error(`${label} (stale save):`, error);
    res.status(409).json({ success: false, message: 'This timetable changed. Reload and try again.' });
};

// How far ahead the dashboard looks for exams to plan study time around.
const EXAM_LOOKAHEAD_DAYS = 30;
// Days off changed in one go from the holiday calendar (a two-week break is 14).
const MAX_DAY_CHANGES = 120;

// Same no-lookalike alphabet the group join codes use.
const SHARE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generateShareCode = () => Array.from(
    crypto.randomBytes(6),
    (byte) => SHARE_CODE_ALPHABET[byte % SHARE_CODE_ALPHABET.length]
).join('');

const createUniqueShareCode = async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const shareCode = generateShareCode();
        if (!(await scheduleModel.exists({ shareCode }))) return shareCode;
    }
    throw new Error('Unable to generate a unique share code.');
};

const fail = (res, status, message) => res.status(status).json({ success: false, message });

export const roleOf = (schedule, userId) => {
    // `owner` is a populated document in list results and a bare id everywhere else.
    if ((schedule.owner._id ?? schedule.owner).toString() === userId) return 'owner';
    const member = schedule.collaborators.find((c) => (c.user._id ?? c.user).toString() === userId);
    return member ? (member.role === 'editor' ? 'editor' : 'viewer') : null;
};

const ROLE_ORDER = ['owner', 'editor', 'viewer'];

const CAN = {
    view: ['owner', 'editor', 'viewer'],
    // Editors change the entries and days off. Name, theme, main and deleting stay with the owner.
    edit: ['owner', 'editor'],
    owner: ['owner'],
};

// Who can add people, change roles and manage the code: the owner, plus editors when the owner
// turned on "editors can share" (the same switch Google Docs has).
const canManageSharing = (schedule, role) => role === 'owner' || (role === 'editor' && schedule.editorsCanShare === true);

// A group's timetable follows the group: who is on it, and with which role, comes from the group's
// members and admins, and it is never anyone's main. Sends the 409 itself and returns true when refused.
const refuseForGroup = (res, schedule) => {
    if (!schedule.group) return false;
    fail(res, 409, "This timetable belongs to a group. Manage who's on it from the group.");
    return true;
};

// 'restricted' when only the people added can open it, otherwise the role the code gives.
const linkAccess = (schedule) => (schedule.shareCode ? (schedule.shareRole === 'editor' ? 'editor' : 'viewer') : 'restricted');

// Loads the schedule and checks the caller's access level. Sends the error response
// itself and returns null when the caller should stop.
const loadSchedule = async (req, res, need) => {
    const { scheduleId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
        fail(res, 404, 'Schedule not found');
        return null;
    }
    const schedule = await scheduleModel.findById(scheduleId);
    if (!schedule) {
        fail(res, 404, 'Schedule not found');
        return null;
    }
    const role = roleOf(schedule, req.userId);
    if (!role) {
        fail(res, 403, 'You do not have access to this schedule');
        return null;
    }
    if (!CAN[need].includes(role)) {
        fail(res, 403, need === 'owner'
            ? 'Only the owner can do that'
            : 'You have view-only access to this schedule');
        return null;
    }
    return { schedule, role };
};

const PERSON_FIELDS = 'name avatar profileTag';

// The group a timetable belongs to, as { _id, name } (name only when `group` is populated), or null.
const groupOf = (schedule) => (schedule.group
    ? { _id: schedule.group._id ?? schedule.group, name: schedule.group.name }
    : null);

const serialize = async (schedule, role, viewerId = '') => {
    await schedule.populate([
        { path: 'owner', select: PERSON_FIELDS },
        { path: 'collaborators.user', select: PERSON_FIELDS },
        { path: 'group', select: 'name' },
    ]);
    const plain = schedule.toObject();
    // Every entry's subject becomes the viewer's own (or null), never the stored id of someone else.
    const subjectViewer = role === 'owner' ? String(schedule.owner._id ?? schedule.owner) : viewerId;
    plain.entries = withViewerSubjects(plain, subjectViewer, subjectViewer ? await activeSubjects(subjectViewer).lean() : []);
    // The caller's own layer (what they follow, hid or customized), and for its editors how many members use
    // their own time for each class (counts only, never names).
    if (subjectViewer && hasLayer(schedule, role)) {
        const layer = await layerOf(subjectViewer, schedule);
        plain.entries = plain.entries.map((entry) => ({ ...entry, ...entryLayer(layer, entry) }));
        plain.myClasses = myClassesOf(plain, layer);
    }
    if (CAN.edit.includes(role) && schedule.collaborators.length) {
        const counts = await customCounts(schedule._id);
        plain.entries = plain.entries.map((entry) => ({ ...entry, ownTimeCount: counts.get(String(entry._id)) ?? 0 }));
    }
    plain.role = role;
    plain.group = groupOf(schedule);
    plain.live = isLive(schedule);
    // Who is on a group's timetable is managed from the group, so nobody shares it from here.
    plain.canShare = !schedule.group && canManageSharing(schedule, role);
    plain.editorsCanShare = schedule.editorsCanShare === true;
    // Enough for everyone on it to see how open the schedule is, without the code itself.
    plain.access = { people: schedule.collaborators.length, link: linkAccess(schedule) };
    if (role !== 'owner') {
        plain.myCountInWorkload = schedule.collaborators.find((c) => (c.user._id ?? c.user).toString() === viewerId)?.countInWorkload === true;
    }
    // Only the people who manage sharing see the code and the full list of who has access.
    if (!plain.canShare) {
        delete plain.shareCode;
        delete plain.shareRole;
        // Members of a live schedule can see who else edits it. Plain viewers stay private.
        plain.collaborators = plain.live ? plain.collaborators.filter((c) => c.role === 'editor') : [];
        if (!plain.live) plain.activity = [];
    }
    return plain;
};

// Lighter than `serialize`: skips the (heavy) entries, for the list view.
const summarize = (schedule, role, userId = '') => ({
    _id: schedule._id,
    title: schedule.title,
    theme: schedule.theme,
    owner: schedule.owner,
    role,
    group: groupOf(schedule),
    isMain: Boolean(schedule.isMain),
    countInWorkload: role === 'owner'
        ? schedule.countInWorkload !== false
        : schedule.collaborators.find((c) => c.user.toString() === userId)?.countInWorkload === true,
    live: isLive(schedule),
    private: schedule.collaborators.length === 0 && !schedule.shareCode,
    entryCount: schedule.entries.length,
    collaboratorCount: schedule.collaborators.length,
    updatedAt: schedule.updatedAt,
});

// The list-view summary of one timetable, as the given user sees it.
export const summarizeFor = (schedule, userId) => summarize(schedule, roleOf(schedule, userId), userId);

export const createSchedule = async (req, res) => {
    try {
        const title = String(req.body.title || '').trim();
        if (!title) return fail(res, 400, 'Give your schedule a name.');
        if (title.length > 80) return fail(res, 400, 'That name is too long (80 characters max).');
        if (req.body.theme && !SCHEDULE_THEMES.includes(req.body.theme)) return fail(res, 400, 'Unknown theme.');

        await ensureMainSchedule(req.userId);
        const ownedCount = await scheduleModel.countDocuments(personalTimetables(req.userId));
        if (ownedCount >= MAX_OWNED_SCHEDULES) {
            return fail(res, 400, `You can have a main schedule and up to ${MAX_OWNED_SCHEDULES - 1} extra ones.`);
        }

        // The first schedule is the main one. Anything after that is an extra.
        const schedule = await scheduleModel.create({
            title,
            owner: req.userId,
            isMain: ownedCount === 0,
            ...(req.body.theme && { theme: req.body.theme }),
        });
        res.status(201).json({ success: true, schedule: await serialize(schedule, 'owner') });
    } catch (error) {
        scheduleError(res, 'createSchedule error', error);
    }
};

export const getSchedules = async (req, res) => {
    try {
        await ensureMainSchedule(req.userId);
        const schedules = await scheduleModel
            .find({ $or: [{ owner: req.userId }, { 'collaborators.user': req.userId }] })
            .populate('owner', PERSON_FIELDS)
            .populate('group', 'name')
            .sort({ updatedAt: -1 });
        res.json({
            success: true,
            schedules: schedules.map((s) => summarize(s, roleOf(s, req.userId), req.userId)),
        });
    } catch (error) {
        scheduleError(res, 'getSchedules error', error);
    }
};

// GET /api/schedules/main: the caller's main schedule in full, or null when they have none yet.
// Extras use it to point out entries that overlap the main one.
export const getMainSchedule = async (req, res) => {
    try {
        const id = await ensureMainSchedule(req.userId);
        if (!id) return res.json({ success: true, schedule: null });
        const schedule = await scheduleModel.findById(id);
        res.json({ success: true, schedule: await serialize(schedule, 'owner') });
    } catch (error) {
        scheduleError(res, 'getMainSchedule error', error);
    }
};

export const getSchedule = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'view');
        if (!loaded) return;
        res.json({ success: true, schedule: await serialize(loaded.schedule, loaded.role, req.userId) });
    } catch (error) {
        scheduleError(res, 'getSchedule error', error);
    }
};

// Settings only the owner changes. On a group's timetable the admins (its editors) may also rename it
// and change its theme.
const OWNER_SETTINGS = ['countInWorkload', 'isMain', 'editorsCanShare'];

export const updateSchedule = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'view');
        if (!loaded) return;
        const { schedule, role } = loaded;
        const groupEditor = Boolean(schedule.group) && role === 'editor';
        if (role !== 'owner' && (!groupEditor || OWNER_SETTINGS.some((key) => req.body[key] !== undefined))) {
            return fail(res, 403, 'Only the owner can do that');
        }
        const { title, theme, countInWorkload, isMain, editorsCanShare } = req.body;
        if (isMain === true && refuseForGroup(res, schedule)) return;

        if (title !== undefined) {
            const trimmed = String(title).trim();
            if (!trimmed) return fail(res, 400, 'Give your schedule a name.');
            if (trimmed.length > 80) return fail(res, 400, 'That name is too long (80 characters max).');
            schedule.title = trimmed;
        }
        if (theme !== undefined) {
            if (!SCHEDULE_THEMES.includes(theme)) return fail(res, 400, 'Unknown theme.');
            schedule.theme = theme;
        }
        if (editorsCanShare !== undefined) schedule.editorsCanShare = Boolean(editorsCanShare);
        // The main schedule always counts. The toggle is only for extras.
        if (countInWorkload !== undefined && !schedule.isMain) schedule.countInWorkload = Boolean(countInWorkload);
        if (isMain === true && !schedule.isMain) {
            // Only one main at a time: the old one becomes an extra.
            await scheduleModel.updateMany({ ...personalTimetables(req.userId), _id: { $ne: schedule._id } }, { isMain: false });
            schedule.isMain = true;
            schedule.countInWorkload = true;
        }
        await schedule.save();
        res.json({ success: true, schedule: await serialize(schedule, role, req.userId) });
    } catch (error) {
        scheduleError(res, 'updateSchedule error', error);
    }
};

export const deleteSchedule = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'owner');
        if (!loaded) return;
        if (loaded.schedule.isMain && await scheduleModel.exists({ ...personalTimetables(req.userId), _id: { $ne: loaded.schedule._id } })) {
            return fail(res, 400, 'This is your main schedule. Make another one your main first, then delete this one.');
        }
        const { schedule } = loaded;
        const others = schedule.collaborators.map((c) => c.user.toString());
        const title = schedule.title;
        const wasLive = isLive(schedule);
        await schedule.deleteOne();
        await forgetTimetables([schedule._id]);
        if (wasLive) {
            const owner = await userModel.findById(req.userId).select('name');
            await notify({
                recipients: others, sender: req.userId, type: 'schedule_change',
                title: 'A shared schedule was deleted', message: `${owner?.name || 'The owner'} deleted "${title}".`,
            });
        }
        res.json({ success: true, message: 'Schedule deleted' });
    } catch (error) {
        scheduleError(res, 'deleteSchedule error', error);
    }
};

const SUBJECT_KINDS = ['class', 'exam'];

const ownerIdOf = (schedule) => String(schedule.owner._id ?? schedule.owner);

// What a write does to an entry's subject link, decided before the entry is cleaned. Answers
//  - { error }: the request named a subject the caller may not use;
//  - { link, name, code, subjects }: `link` is a subject document, null (no subject) or undefined (keep the
//    stored one); `name` (and an optional `code`) is set when a new subject has to be made once the entry is valid.
// Only the timetable's owner picks, creates or clears a subject, and only from their own active ones.
// An editor's `subject` and `newSubject` are ignored: a class they add links to the owner's subject of
// that name, so the owner sees it linked, and an edit keeps whatever link the entry has, even when the
// editor turns it into an event for a while.
// A group's timetable stores no subject at all: it is nobody's own, and each member's subject is matched by
// name when they read it.
const readEntrySubject = async (req, schedule, { adding, kind }) => {
    if (schedule.group) return { link: null };
    const { body } = req;
    const ownerId = ownerIdOf(schedule);
    if (ownerId !== req.userId && !adding) return { link: undefined };
    if (!SUBJECT_KINDS.includes(kind)) return { link: null };
    const byName = async () => {
        const subjects = await activeSubjects(ownerId);
        return { link: entrySubjectFor({ kind, title: String(body.title || '') }, subjects) };
    };

    if (ownerId !== req.userId) return byName();

    if (body.newSubject !== undefined && body.newSubject !== null) {
        const planned = await planNewSubject(ownerId, body.newSubject, body.newSubjectCode);
        if (planned.error) return { error: planned.error };
        return planned.subject ? { link: planned.subject } : { link: null, name: planned.name, code: planned.code, subjects: planned.subjects };
    }
    if (body.subject !== undefined) {
        const { subject, error } = await resolveItemSubject(ownerId, { subject: body.subject });
        return error ? { error } : { link: subject };
    }
    return adding ? byName() : { link: undefined };
};

// Reads the body into a clean entry plus the subject link it should carry. Sends the error itself and
// returns null when the caller should stop. A class with a subject is titled with the subject's name
// (the class form has no title field).
// `stored` is the entry being edited. When the write keeps its link, the class is still titled with that
// subject's name, so an editor can't retitle a linked class away from it.
const readEntryWrite = async (req, res, schedule, { adding, stored }) => {
    const kind = ENTRY_KINDS.includes(req.body.kind) ? req.body.kind : 'class';
    const resolved = await readEntrySubject(req, schedule, { adding, kind });
    if (resolved.error) {
        fail(res, 400, resolved.error);
        return null;
    }
    const kept = resolved.link === undefined && stored?.subject ? await subjectModel.findById(stored.subject).select('name') : null;
    const subjectName = resolved.link?.name ?? resolved.name ?? kept?.name;
    const body = kind === 'class' && subjectName ? { ...req.body, title: subjectName } : req.body;
    const { entry, error } = cleanEntry(body);
    if (error) {
        fail(res, 400, error);
        return null;
    }
    return { entry, resolved };
};

// Makes the new subject an entry asked for, now that the entry is valid. Returns the link to store
// (undefined keeps the stored one) and the subject that was created, if any.
const finishEntrySubject = async (schedule, resolved) => {
    if (!resolved.name) return { link: resolved.link, created: null };
    const created = await createPlannedSubject(ownerIdOf(schedule), { name: resolved.name, code: resolved.code, subjects: resolved.subjects });
    return { link: created, created };
};

const linkId = (link) => (link ? link._id : null);

// Adds a cleaned entry to a schedule the caller may edit and answers with the schedule (and the subject
// when the request made one).
const appendEntry = async (req, res, schedule, role, { entry, resolved }) => {
    if (schedule.entries.length >= MAX_ENTRIES) {
        return fail(res, 400, `A schedule can hold up to ${MAX_ENTRIES} entries.`);
    }
    const { link, created } = await finishEntrySubject(schedule, resolved);
    schedule.entries.push({ ...entry, subject: linkId(link) });
    const announce = await recordChange(schedule, req.userId, `added ${describeEntry(entry)}`);
    await schedule.save();
    await announce();
    res.status(201).json({
        success: true,
        schedule: await serialize(schedule, role, req.userId),
        ...(created && { subject: publicSubject(created) }),
    });
};

export const addEntry = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'edit');
        if (!loaded) return;

        const write = await readEntryWrite(req, res, loaded.schedule, { adding: true });
        if (write) await appendEntry(req, res, loaded.schedule, loaded.role, write);
    } catch (error) {
        scheduleError(res, 'addEntry error', error);
    }
};

// POST /api/schedules/main/entries: adds a class, exam or event to the caller's main timetable in
// one request, creating the timetable first when they have none.
export const addMainEntry = async (req, res) => {
    try {
        // Validate first so a bad entry doesn't create the timetable. The caller owns their main one.
        const write = await readEntryWrite(req, res, { owner: req.userId }, { adding: true });
        if (write) await appendEntry(req, res, await mainScheduleOrNew(req.userId), 'owner', write);
    } catch (error) {
        scheduleError(res, 'addMainEntry error', error);
    }
};

export const updateEntry = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'edit');
        if (!loaded) return;
        const { schedule, role } = loaded;

        const existing = schedule.entries.id(req.params.entryId);
        if (!existing) return fail(res, 404, 'Entry not found');

        const write = await readEntryWrite(req, res, schedule, { adding: false, stored: existing });
        if (!write) return;
        const { entry } = write;
        const { link, created } = await finishEntrySubject(schedule, write.resolved);
        const renamed = existing.title !== entry.title ? ` (was "${existing.title}")` : '';
        // `entry` carries no subject, so `set` keeps the stored link unless the owner changed it above.
        existing.set(entry);
        if (link !== undefined) existing.subject = linkId(link);
        // Only a live timetable announces changes, so only then is it worth working out who hears.
        const audience = isLive(schedule) ? await changeAudience(schedule, existing) : null;
        const announce = await recordChange(schedule, req.userId, `edited ${describeEntry(entry)}${renamed}`, { audience });
        await schedule.save();
        await announce();
        res.json({
            success: true,
            schedule: await serialize(schedule, role, req.userId),
            ...(created && { subject: publicSubject(created) }),
        });
    } catch (error) {
        scheduleError(res, 'updateEntry error', error);
    }
};

export const deleteEntry = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'edit');
        if (!loaded) return;
        const { schedule, role } = loaded;

        const existing = schedule.entries.id(req.params.entryId);
        if (!existing) return fail(res, 404, 'Entry not found');
        const removedTitle = existing.title;
        const audience = isLive(schedule) ? await changeAudience(schedule, existing, { removed: true }) : null;
        existing.deleteOne();
        const announce = await recordChange(schedule, req.userId, `removed ${describeEntry({ title: removedTitle })}`, { audience });
        await schedule.save();
        await announce();
        res.json({ success: true, schedule: await serialize(schedule, role, req.userId) });
    } catch (error) {
        scheduleError(res, 'deleteEntry error', error);
    }
};

// GET /api/schedules/holidays?year=2026  (always Philippine holidays)
export const getHolidays = async (req, res) => {
    try {
        const year = Number(req.query.year);
        if (!Number.isInteger(year) || year < 1970 || year > 2100) return fail(res, 400, 'Pick a valid year.');

        const holidays = await fetchPublicHolidays(year, HOLIDAY_COUNTRY);
        res.json({ success: true, holidays });
    } catch {
        // The schedule still works without the list (users can add their own days off),
        // so this is a soft failure the client can show as a notice.
        fail(res, 502, "Couldn't load public holidays right now.");
    }
};

const DAY_CHANGE_VERB = { holiday: 'marked', workday: 'cleared', null: 'reset' };

// One line for the change log: "marked Dec 20 as a day off", "marked 5 days off (2026-12-20 to 2026-12-24)".
const describeDayChanges = (changes) => {
    const dates = changes.map((c) => c.date).sort();
    const states = new Set(changes.map((c) => c.state));
    if (changes.length === 1) {
        const { date, state } = changes[0];
        return state === null ? `reset the day off on ${date}` : state === 'holiday' ? `marked ${date} as a day off` : `marked ${date} as a normal day`;
    }
    const span = `${dates[0]} to ${dates[dates.length - 1]}`;
    if (states.size > 1) return `updated days off on ${changes.length} days (${span})`;
    const [state] = states;
    if (state === 'holiday') return `marked ${changes.length} days off (${span})`;
    return `${DAY_CHANGE_VERB[state]} ${changes.length} days off (${span})`;
};

// PUT /api/schedules/:scheduleId/holidays
//   { date, state: 'holiday' | 'workday' | null, name? }    one day, or
//   { changes: [{ date, state, name? }, ...] }               several, from the holiday calendar
// A null state removes the override, which puts the day back to whatever the
// public holiday list says.
export const setHolidayOverride = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'edit');
        if (!loaded) return;
        const { schedule, role } = loaded;

        const changes = Array.isArray(req.body.changes)
            ? req.body.changes
            : [{ date: req.body.date, state: req.body.state, name: req.body.name }];
        if (!changes.length) return fail(res, 400, 'Pick at least one day.');
        if (changes.length > MAX_DAY_CHANGES) return fail(res, 400, `You can change up to ${MAX_DAY_CHANGES} days at once.`);
        const seen = new Set();
        for (const change of changes) {
            if (!isRealDate(change?.date || '')) return fail(res, 400, 'That date is not valid.');
            if (change.state !== null && !['holiday', 'workday'].includes(change.state)) return fail(res, 400, 'Unknown holiday state.');
            if (seen.has(change.date)) return fail(res, 400, 'The same day is listed twice.');
            seen.add(change.date);
        }

        for (const { date, state, name } of changes) {
            const index = schedule.holidayOverrides.findIndex((o) => o.date === date);
            if (state === null) {
                if (index !== -1) schedule.holidayOverrides.splice(index, 1);
            } else {
                const override = { date, state, name: state === 'holiday' ? String(name || '').trim().slice(0, 80) : '' };
                if (index === -1) schedule.holidayOverrides.push(override);
                else schedule.holidayOverrides.set(index, override);
            }
        }
        const announce = await recordChange(schedule, req.userId, describeDayChanges(changes));
        await schedule.save();
        await announce();
        res.json({ success: true, schedule: await serialize(schedule, role, req.userId) });
    } catch (error) {
        scheduleError(res, 'setHolidayOverride error', error);
    }
};

// ---- Copying someone else's schedule ----------------------------------------------
// Works like sharing a task: the person copies a share code (or taps a schedule a
// groupmate posted in chat), sees what is in it and what clashes with their own week,
// and adds it to a schedule of their own. Nothing is shared live, the copy is theirs.

const PLAIN_ENTRY_FIELDS = [
    'title', 'kind', 'days', 'date', 'startDate', 'endDate', 'startTime', 'endTime',
    'location', 'meetingUrl', 'notes', 'color', 'icon', 'skipOnHoliday', 'prepHours',
];

// Loads whatever the request points at: a share code, or a schedule message in one of the
// caller's groups. Sends the error itself and returns null when the caller should stop.
const loadImportSource = async (req, res) => {
    const { shareCode, groupId, messageId, scheduleId } = req.body;

    // A schedule a friend shared with the caller directly. They can look and copy, nothing more.
    if (scheduleId) {
        if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
            fail(res, 404, 'That shared schedule is no longer available.');
            return null;
        }
        const shared = await scheduleModel.findById(scheduleId).populate('owner', 'name');
        const role = shared && roleOf(shared, req.userId);
        if (!shared || !role) {
            fail(res, 404, 'That shared schedule is no longer available.');
            return null;
        }
        if (role === 'owner') {
            fail(res, 400, 'That is your own schedule.');
            return null;
        }
        const plain = shared.toObject();
        return {
            token: `schedule:${shared._id}`,
            title: plain.title, ownerName: plain.owner?.name || '', theme: plain.theme,
            entries: plain.entries,
        };
    }

    if (messageId) {
        if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(messageId)) {
            fail(res, 404, 'That shared schedule is no longer available.');
            return null;
        }
        const group = await groupModel.findById(groupId);
        if (!group || !group.members.some((m) => m.toString() === req.userId)) {
            fail(res, 403, 'You are not a member of this group');
            return null;
        }
        const message = await groupMessageModel.findOne({ _id: messageId, group: groupId, type: 'schedule' });
        if (!message?.schedule) {
            fail(res, 404, 'That shared schedule is no longer available.');
            return null;
        }
        const snap = message.schedule.toObject();
        return {
            token: `message:${message._id}`,
            title: snap.title, ownerName: snap.ownerName, theme: snap.theme,
            entries: snap.entries.map((e) => ({ ...e, image: '' })),
        };
    }

    const code = String(shareCode || '').trim().toUpperCase();
    if (!code) {
        fail(res, 400, 'Please enter a share code.');
        return null;
    }
    // A group's timetable is never opened by code (it has none; `group: null` makes sure).
    const schedule = await scheduleModel.findOne({ shareCode: code, group: null }).populate('owner', 'name');
    if (!schedule) {
        fail(res, 404, 'No schedule found with that code.');
        return null;
    }
    if (schedule.owner._id.toString() === req.userId) {
        fail(res, 400, 'That is your own schedule.');
        return null;
    }
    const plain = schedule.toObject();
    return {
        token: `schedule:${schedule._id}`,
        scheduleId: String(schedule._id),
        title: plain.title, ownerName: plain.owner?.name || '', theme: plain.theme,
        entries: plain.entries,
        // A code works like a Google Docs link: it opens the schedule itself, as a viewer or an editor.
        codeRole: plain.shareRole === 'editor' ? 'editor' : 'viewer',
        memberRole: roleOf(schedule, req.userId),
    };
};

const ownedForImport = async (userId) => {
    await ensureMainSchedule(userId);
    return scheduleModel.find(personalTimetables(userId)).select('title entries countInWorkload isMain importedFrom').sort({ isMain: -1, createdAt: 1 }).lean();
};

// POST /api/schedules/preview  { shareCode } or { groupId, messageId }
// What is in the schedule, plus the caller's own entries so the client can point out clashes
// (and re-check them live as the person edits a time before adding).
export const previewImport = async (req, res) => {
    try {
        const source = await loadImportSource(req, res);
        if (!source) return;

        const owned = await ownedForImport(req.userId);
        const mySubjects = await activeSubjects(req.userId).lean();
        res.json({
            success: true,
            source: {
                title: source.title, ownerName: source.ownerName, theme: source.theme,
                alreadyAdded: owned.some((s) => (s.importedFrom || []).includes(source.token)),
                canJoinLive: source.codeRole === 'editor',
                codeRole: source.codeRole || null,
                // Already on it (opened the link before): the dialog offers to open it instead of joining.
                ...(source.memberRole && { memberRole: source.memberRole, scheduleId: source.scheduleId }),
            },
            entries: source.entries.map((e) => ({
                ..._pick(e, ['_id', ...PLAIN_ENTRY_FIELDS]),
                // The owner's subject id stays on the server.
                subject: null,
                hasImage: Boolean(e.image),
            })),
            // Only the schedules that count toward the caller's week can clash with it.
            existing: owned
                .filter((s) => s.isMain || s.countInWorkload !== false)
                .flatMap((s) => withViewerSubjects(s, req.userId, mySubjects).map((entry) => ({
                    scheduleId: s._id,
                    scheduleTitle: s.title,
                    entry: _pick(entry, ['_id', 'subject', ...PLAIN_ENTRY_FIELDS]),
                }))),
            schedules: owned.map((s) => ({ _id: s._id, title: s.title, isMain: Boolean(s.isMain), entryCount: s.entries.length })),
        });
    } catch (error) {
        scheduleError(res, 'previewImport error', error);
    }
};

const _pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

const EDITABLE_ON_IMPORT = ['title', 'startTime', 'endTime', 'days', 'date', 'startDate', 'endDate', 'location', 'notes', 'prepHours'];

// POST /api/schedules/import
//   { shareCode | groupId + messageId,
//     selections: [{ id, edits? }],     which entries to copy, with any changes made in the preview
//     targetScheduleId?,                add into one of the caller's schedules, or
//     title? }                          leave the target out to make a new schedule
export const importSchedule = async (req, res) => {
    try {
        const source = await loadImportSource(req, res);
        if (!source) return;

        const selections = Array.isArray(req.body.selections) ? req.body.selections : [];
        if (!selections.length) return fail(res, 400, 'Pick at least one entry to add.');

        const byId = new Map(source.entries.map((e) => [String(e._id), e]));
        const cleaned = [];
        for (const selection of selections) {
            const original = byId.get(String(selection?.id));
            if (!original) return fail(res, 400, 'One of those entries is no longer in the shared schedule.');
            const merged = { ...original };
            for (const key of EDITABLE_ON_IMPORT) {
                if (selection.edits?.[key] !== undefined) merged[key] = selection.edits[key];
            }
            // Switching a one-off into a weekly entry (or back) is a full swap of its timing.
            if (selection.edits?.date) merged.days = [];
            if (selection.edits?.days?.length && selection.edits.date === undefined) merged.date = '';
            const { entry, error } = cleanEntry(merged);
            if (error) return fail(res, 400, `${original.title}: ${error}`);
            cleaned.push(entry);
        }
        // The copy is the caller's own: its classes and exams belong to the caller's subjects of that name.
        const mySubjects = await activeSubjects(req.userId).lean();
        cleaned.forEach((entry) => {
            entry.subject = entrySubjectFor(entry, mySubjects)?._id ?? null;
        });

        // By default the entries go into the caller's main schedule. They can pick one of their
        // extras, or ask for a new extra (newSchedule). With no schedule at all, the copy becomes the main one.
        await ensureMainSchedule(req.userId);
        let schedule;
        if (req.body.targetScheduleId) {
            if (!mongoose.Types.ObjectId.isValid(req.body.targetScheduleId)) return fail(res, 404, 'Schedule not found');
            schedule = await scheduleModel.findOne({ _id: req.body.targetScheduleId, ...personalTimetables(req.userId) });
            if (!schedule) return fail(res, 404, 'Schedule not found');
        } else {
            const main = req.body.newSchedule ? null : await scheduleModel.findOne({ ...personalTimetables(req.userId), isMain: true });
            if (main) {
                schedule = main;
            } else {
                const ownedCount = await scheduleModel.countDocuments(personalTimetables(req.userId));
                if (ownedCount >= MAX_OWNED_SCHEDULES) {
                    return fail(res, 400, `You can have a main schedule and up to ${MAX_OWNED_SCHEDULES - 1} extra ones.`);
                }
                const title = String(req.body.title || source.title || 'Shared schedule').trim().slice(0, 80) || 'Shared schedule';
                schedule = new scheduleModel({ title, owner: req.userId, isMain: ownedCount === 0, theme: source.theme });
            }
        }

        if (schedule.entries.length + cleaned.length > MAX_ENTRIES) {
            return fail(res, 400, `A schedule can hold up to ${MAX_ENTRIES} entries. Pick fewer, or add to a different schedule.`);
        }
        cleaned.forEach((entry) => schedule.entries.push(entry));
        if (!schedule.importedFrom.includes(source.token)) schedule.importedFrom.push(source.token);
        await schedule.save();

        res.status(201).json({ success: true, added: cleaned.length, schedule: await serialize(schedule, 'owner') });
    } catch (error) {
        scheduleError(res, 'importSchedule error', error);
    }
};

// The shared timetables the caller still has a role on, doesn't count in their week, and has customized a class
// of ("Just for me" with Count off). Only their copies need the layer marks (never these timetables' own classes,
// which stay out of the week). Someone who left or never had a role gets none.
const uncountedWithCopies = async (userId, counted) => {
    const docs = await classChoiceModel
        .find({ user: userId, schedule: { $nin: counted.map((s) => s._id) }, 'choices.choice': 'custom' })
        .select('schedule')
        .lean();
    if (!docs.length) return [];
    const found = await scheduleModel.find({ _id: { $in: docs.map((d) => d.schedule) } }).populate('group', 'name').lean();
    return found.filter((s) => {
        s.role = roleOf(s, userId);
        return hasLayer(s, s.role);
    });
};

// The timetables that count in the caller's week, ready to read: holidays resolved, the caller's role and
// their own subject on each entry, their own layer applied to shared ones (classes they hid or customized
// left out), personal ones first. `startIso` to `endIso` is the range holidays are looked up for; a failed
// lookup only means public holidays are missing.
const countedSchedules = async (userId, startIso, endIso) => {
    // The main schedule always counts. Extras count unless the student turned them off.
    await ensureMainSchedule(userId);
    const schedules = await scheduleModel
        .find({
            $or: [
                { owner: userId, $or: [{ isMain: true }, { countInWorkload: { $ne: false } }] },
                // Shared schedules the member chose to count (off unless they turn it on).
                { collaborators: { $elemMatch: { user: userId, countInWorkload: true } } },
            ],
        })
        .populate('group', 'name')
        .lean();

    // One holiday lookup per year the range touches.
    const publicByDate = {};
    if (schedules.length) {
        const years = [...new Set([startIso, endIso].map((iso) => Number(iso.slice(0, 4))))];
        await Promise.all(years.map(async (year) => {
            try {
                (await fetchPublicHolidays(year, HOLIDAY_COUNTRY)).forEach((h) => { publicByDate[h.date] = h.name; });
            } catch {
                // Leave them out.
            }
        }));
    }
    const mySubjects = await activeSubjects(userId).lean();
    schedules.forEach((s) => {
        s.publicByDate = publicByDate;
        s.role = roleOf(s, userId);
        s.entries = withViewerSubjects(s, userId, mySubjects);
    });
    // Only a student who counts a shared timetable has choices to read.
    const layered = schedules.filter((s) => hasLayer(s, s.role));
    const uncounted = await uncountedWithCopies(userId, schedules);
    if (layered.length || uncounted.length) {
        applyChoices(schedules, await choicesFor(userId, [...layered, ...uncounted].map((s) => s._id)), uncounted);
    }
    // Personal first, so a class copied into two timetables keeps the copy the student can edit.
    const rank = (s) => (s.role === 'owner' && !s.group ? 0 : 1 + ROLE_ORDER.indexOf(s.role));
    return schedules.sort((a, b) => rank(a) - rank(b));
};

// GET /api/schedules/week?start=YYYY-MM-DD
// The next seven days of the caller's own timetables (the ones marked to count), with
// holidays applied. The dashboard uses this to see how much time is already taken.
export const getWeekOverview = async (req, res) => {
    try {
        const start = String(req.query.start || '');
        if (!isRealDate(start)) return fail(res, 400, 'Pick a valid start date.');
        const dayCount = 7;
        const end = addDaysIso(start, dayCount - 1);

        const schedules = await countedSchedules(req.userId, start, end);

        res.json({
            success: true,
            scheduleCount: schedules.length,
            entryCount: schedules.reduce((n, s) => n + s.entries.length, 0),
            days: buildWeekOverview(schedules, start, dayCount),
            // Exams coming up over the next month, so the dashboard can plan study time for them.
            upcomingExams: findUpcomingExams(schedules, start, EXAM_LOOKAHEAD_DAYS),
        });
    } catch (error) {
        scheduleError(res, 'getWeekOverview error', error);
    }
};

const SUBJECT_UPCOMING_DAYS = 14;
const SUBJECT_EXAM_DAYS = 30;

// Class entries (patterns, not days) of a subject, from the timetables that count for the caller.
const classTimesOf = (schedules, subjectId) => schedules
    .flatMap((schedule) => schedule.entries
        .filter((e) => e.kind === 'class' && e.subject === subjectId)
        .map((e) => ({
            entryId: String(e._id),
            scheduleId: String(schedule._id),
            scheduleTitle: schedule.title,
            isMain: schedule.isMain === true,
            canEdit: CAN.edit.includes(schedule.role),
            live: isLive(schedule),
            ...pickClassTime(e),
        })))
    .sort((a, b) => (a.days[0] ?? 7) - (b.days[0] ?? 7) || a.startTime.localeCompare(b.startTime));

// GET /api/subjects/:id/schedule?start=YYYY-MM-DD
// Everything the timetables say about one of the caller's subjects: its class times (each with where it
// lives and whether the caller may edit it), the next two weeks of its classes and exams, and its exams.
// Only timetables the caller owns or counts as a member are read, and the caller's own subject ids are used.
export const getSubjectSchedule = async (req, res) => {
    try {
        const subject = isId(req.params.id) && await subjectModel.findOne({ _id: req.params.id, owner: req.userId });
        if (!subject) return fail(res, 404, 'Subject not found');
        const start = String(req.query.start || '');
        if (!isRealDate(start)) return fail(res, 400, 'Pick a valid start date.');

        const subjectId = String(subject._id);
        const schedules = await countedSchedules(req.userId, start, addDaysIso(start, Math.max(SUBJECT_UPCOMING_DAYS, SUBJECT_EXAM_DAYS)));
        const mine = (entry) => entry.subject === subjectId;
        res.json({
            success: true,
            classTimes: classTimesOf(schedules, subjectId),
            upcoming: buildWeekOverview(schedules, start, SUBJECT_UPCOMING_DAYS)
                .flatMap((day) => day.entries.filter(mine).map((entry) => ({ iso: day.date, entry }))),
            exams: findUpcomingExams(schedules, start, SUBJECT_EXAM_DAYS).filter(mine),
        });
    } catch (error) {
        scheduleError(res, 'getSubjectSchedule error', error);
    }
};

const areFriends = async (a, b) => Boolean(await Friend.exists({
    status: 'accepted',
    $or: [{ user: a, friend: b }, { user: b, friend: a }],
}));

// Loads a schedule for a sharing change: the owner, or an editor when the owner lets editors share.
const loadForSharing = async (req, res) => {
    const loaded = await loadSchedule(req, res, 'view');
    if (!loaded || refuseForGroup(res, loaded.schedule)) return null;
    if (!canManageSharing(loaded.schedule, loaded.role)) {
        fail(res, 403, loaded.role === 'editor'
            ? "The owner hasn't let editors share this schedule."
            : 'Only the owner can change who has access');
        return null;
    }
    return loaded;
};

// POST /api/schedules/:scheduleId/share  { userId, role: 'viewer' | 'editor' }
// Adds a friend, or changes the role of someone already on it. Viewers open the schedule itself
// and see every change as it happens, like a view-only Google Doc. Editors change it too.
export const shareWithFriend = async (req, res) => {
    try {
        const loaded = await loadForSharing(req, res);
        if (!loaded) return;
        const { schedule, role: actorRole } = loaded;
        const { userId } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId)) return fail(res, 404, 'User not found');
        if (userId === req.userId) return fail(res, 400, 'You are already on this schedule.');
        if (userId === schedule.owner.toString()) return fail(res, 400, 'They own this schedule.');

        const role = req.body.role === 'editor' ? 'editor' : 'viewer';
        const existing = schedule.collaborators.find((c) => c.user.toString() === userId);
        // New people have to be the sharer's friends. Changing the role of someone already on it doesn't.
        if (!existing && !(await areFriends(req.userId, userId))) return fail(res, 403, 'You can only share with your friends.');

        const sender = await userModel.findById(req.userId).select('name');
        const senderName = sender?.name || 'A friend';
        const link = timetableLink(schedule._id);
        let announcement = null;
        if (!existing) {
            schedule.collaborators.push({ user: userId, role });
            announcement = {
                recipients: [userId],
                sender: req.userId,
                type: 'schedule_share',
                title: role === 'editor' ? 'You can edit a shared schedule' : 'Schedule shared with you',
                message: role === 'editor'
                    ? `${senderName} added you to the schedule "${schedule.title}". You can change it, and everyone on it is told when you do.`
                    : `${senderName} shared the schedule "${schedule.title}" with you. You'll see changes as they happen, and you can make your own copy.`,
                link,
            };
        } else if (existing.role !== role) {
            existing.role = role;
            announcement = {
                recipients: [userId],
                sender: req.userId,
                type: 'schedule_share',
                title: role === 'editor' ? 'You can now edit a schedule' : 'Your access changed',
                message: role === 'editor'
                    ? `${senderName} let you edit "${schedule.title}".`
                    : `${senderName} changed your access to "${schedule.title}" to view only.`,
                link,
            };
        }
        await schedule.save();
        if (announcement) await notify(announcement);
        res.json({ success: true, schedule: await serialize(schedule, actorRole, req.userId) });
    } catch (error) {
        scheduleError(res, 'shareWithFriend error', error);
    }
};

export const removeCollaborator = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'view');
        if (!loaded || refuseForGroup(res, loaded.schedule)) return;
        const { schedule, role } = loaded;
        const { userId } = req.params;
        const leaving = userId === req.userId;

        // People who manage sharing can remove anyone else. Everyone can remove themselves (leave).
        if (!leaving && !canManageSharing(schedule, role)) return fail(res, 403, 'Only the owner can do that');
        const index = schedule.collaborators.findIndex((c) => c.user.toString() === userId);
        if (index === -1) return fail(res, 404, 'That person is not on this schedule');

        const wasEditor = schedule.collaborators[index].role === 'editor';
        schedule.collaborators.splice(index, 1);
        await schedule.save();
        await forgetChoices(schedule._id, userId);
        if (!leaving) {
            await notify({
                recipients: [userId], sender: req.userId, type: 'schedule_share',
                title: 'Removed from a schedule', message: `You no longer have access to "${schedule.title}".`,
            });
        } else if (wasEditor) {
            const person = await userModel.findById(userId).select('name');
            await notify({
                recipients: [schedule.owner], sender: userId, type: 'schedule_change',
                title: `"${schedule.title}" was changed`, message: `${person?.name || 'Someone'} left the schedule.`,
                link: timetableLink(schedule._id),
            });
        }
        res.json({
            success: true,
            ...(!leaving && { schedule: await serialize(schedule, role, req.userId) }),
        });
    } catch (error) {
        scheduleError(res, 'removeCollaborator error', error);
    }
};

// PUT /api/schedules/:scheduleId/share-code  { enabled?, regenerate?, role? }
// The code (and the link built from it) is the "general access" setting: off means only the
// people added can open the schedule.
export const updateShareCode = async (req, res) => {
    try {
        const loaded = await loadForSharing(req, res);
        if (!loaded) return;
        const { schedule, role } = loaded;
        const { enabled, regenerate } = req.body;

        // 'editor' codes put whoever opens them on the schedule as an editor, 'viewer' codes as a viewer.
        if (req.body.role !== undefined) schedule.shareRole = req.body.role === 'editor' ? 'editor' : 'viewer';
        if (enabled === false) {
            schedule.shareCode = undefined;
        } else if (enabled === true || regenerate) {
            if (!schedule.shareCode || regenerate) schedule.shareCode = await createUniqueShareCode();
        }
        await schedule.save();
        res.json({ success: true, schedule: await serialize(schedule, role, req.userId) });
    } catch (error) {
        scheduleError(res, 'updateShareCode error', error);
    }
};

// POST /api/schedules/:scheduleId/make-private
// Owner only. Everyone else loses access, and the code stops working. Copies people already
// made stay theirs.
export const makePrivate = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'owner');
        if (!loaded || refuseForGroup(res, loaded.schedule)) return;
        const { schedule } = loaded;
        const removed = schedule.collaborators.map((c) => c.user.toString());
        schedule.collaborators = [];
        schedule.shareCode = undefined;
        await schedule.save();
        await forgetChoices(schedule._id);
        if (removed.length) {
            const owner = await userModel.findById(req.userId).select('name');
            await notify({
                recipients: removed, sender: req.userId, type: 'schedule_share',
                title: 'A schedule is now private',
                message: `${owner?.name || 'The owner'} made "${schedule.title}" private, so you no longer have access. Any copy you made is still yours.`,
            });
        }
        res.json({ success: true, removed: removed.length, schedule: await serialize(schedule, 'owner') });
    } catch (error) {
        scheduleError(res, 'makePrivate error', error);
    }
};

// GET /api/schedules/:scheduleId/stamp
// A tiny check the open schedule page polls every few seconds. It only downloads the whole
// schedule (pictures and all) when this says something changed.
export const getScheduleStamp = async (req, res) => {
    try {
        const { scheduleId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(scheduleId)) return fail(res, 404, 'Schedule not found');
        const schedule = await scheduleModel.findById(scheduleId).select('owner collaborators updatedAt').lean();
        if (!schedule) return fail(res, 404, 'Schedule not found');
        const role = roleOf(schedule, req.userId);
        if (!role) return fail(res, 403, 'You do not have access to this schedule');
        res.json({ success: true, updatedAt: schedule.updatedAt, role });
    } catch (error) {
        scheduleError(res, 'getScheduleStamp error', error);
    }
};

// PUT /api/schedules/:scheduleId/membership  { countInWorkload }
// A member decides whether this shared schedule counts toward their own dashboard workload.
export const updateMembership = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'view');
        if (!loaded) return;
        const { schedule, role } = loaded;
        if (role === 'owner') return fail(res, 400, 'Use the schedule settings for your own schedule.');
        const member = schedule.collaborators.find((c) => c.user.toString() === req.userId);
        member.countInWorkload = Boolean(req.body.countInWorkload);
        await schedule.save();
        res.json({ success: true, schedule: await serialize(schedule, role, req.userId) });
    } catch (error) {
        scheduleError(res, 'updateMembership error', error);
    }
};

// POST /api/schedules/join  { shareCode }
// Opening a code or link puts the person on the schedule with the role the code gives.
export const joinByCode = async (req, res) => {
    try {
        const shareCode = String(req.body.shareCode || '').trim().toUpperCase();
        if (!shareCode) return fail(res, 400, 'Please enter a share code.');

        const schedule = await scheduleModel.findOne({ shareCode });
        if (!schedule) return fail(res, 404, 'No schedule found with that code.');
        if (refuseForGroup(res, schedule)) return;

        let role = roleOf(schedule, req.userId);
        const codeRole = schedule.shareRole === 'editor' ? 'editor' : 'viewer';
        // A viewer who opens an editor code moves up. Nobody is ever moved down by a code.
        const member = role && role !== 'owner' ? schedule.collaborators.find((c) => c.user.toString() === req.userId) : null;
        if (!role || (member && member.role === 'viewer' && codeRole === 'editor')) {
            if (member) member.role = codeRole;
            else schedule.collaborators.push({ user: req.userId, role: codeRole });
            role = codeRole;
            const person = await userModel.findById(req.userId).select('name');
            await schedule.save();
            await notify({
                recipients: [schedule.owner], sender: req.userId, type: 'schedule_change',
                title: `"${schedule.title}" was changed`,
                message: `${person?.name || 'Someone'} joined with the share code${role === 'editor' ? ' and can edit it' : ''}.`,
                link: timetableLink(schedule._id), collapseLink: true,
            });
        }
        res.json({ success: true, schedule: await serialize(schedule, role, req.userId) });
    } catch (error) {
        scheduleError(res, 'joinByCode error', error);
    }
};

// POST /api/schedules/:scheduleId/duplicate  { title? }
// "Make a copy": anyone who can view gets their own private, editable copy as an extra schedule
// (or as their main, if it is their first). Nothing links it back to the original.
export const duplicateSchedule = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'view');
        if (!loaded) return;
        const { schedule } = loaded;

        await ensureMainSchedule(req.userId);
        const ownedCount = await scheduleModel.countDocuments(personalTimetables(req.userId));
        if (ownedCount >= MAX_OWNED_SCHEDULES) {
            return fail(res, 400, `You can have a main schedule and up to ${MAX_OWNED_SCHEDULES - 1} extra ones.`);
        }
        const source = schedule.toObject();
        // A copy of someone else's timetable links to the copier's subjects by name, never the owner's.
        source.entries = withViewerSubjects(source, req.userId, await activeSubjects(req.userId).lean());
        const title = String(req.body?.title || '').trim().slice(0, 80) || `Copy of ${source.title}`.slice(0, 80);
        const copy = await scheduleModel.create({
            isMain: ownedCount === 0,
            title,
            owner: req.userId,
            theme: source.theme,
            entries: source.entries.map(({ _id, copyOf, ...rest }) => rest),
            holidayOverrides: source.holidayOverrides,
            // A copy of someone else's timetable is usually the user's own week too.
            countInWorkload: true,
        });
        res.status(201).json({ success: true, schedule: await serialize(copy, 'owner') });
    } catch (error) {
        scheduleError(res, 'duplicateSchedule error', error);
    }
};
