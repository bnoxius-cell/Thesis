import crypto from 'crypto';
import mongoose from 'mongoose';
import scheduleModel, { SCHEDULE_THEMES, MAX_ENTRIES, MAX_ACTIVITY, MAX_IMAGE_LENGTH, MAX_OWNED_SCHEDULES, ENTRY_KINDS } from '../models/scheduleModel.js';
import Friend from '../models/Friend.js';
import { notify } from '../utils/notify.js';
import userModel from '../models/userModel.js';
import { fetchPublicHolidays } from '../utils/holidays.js';
import { buildWeekOverview, addDaysIso, findUpcomingExams } from '../utils/weekOverview.js';
import groupModel from '../models/groupMode.js';
import groupMessageModel from '../models/groupMessageModel.js';

// How far ahead the dashboard looks for exams to plan study time around.
const EXAM_LOOKAHEAD_DAYS = 30;
const DEFAULT_PREP_HOURS = 4;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const ICON_RE = /^[a-z0-9-]{0,30}$/;
const IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

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

const roleOf = (schedule, userId) => {
    // `owner` is a populated document in list results and a bare id everywhere else.
    if ((schedule.owner._id ?? schedule.owner).toString() === userId) return 'owner';
    const member = schedule.collaborators.find((c) => (c.user._id ?? c.user).toString() === userId);
    return member ? (member.role === 'editor' ? 'editor' : 'viewer') : null;
};

const CAN = {
    view: ['owner', 'editor', 'viewer'],
    // Editors change the entries and days off. Name, theme, country, main and sharing stay with the owner.
    edit: ['owner', 'editor'],
    owner: ['owner'],
};

// A schedule is "live" once at least one person other than the owner can edit it. Only then
// are changes logged and announced, so a plain copy-share stays quiet.
const isLive = (schedule) => schedule.collaborators.some((c) => c.role === 'editor');

const memberIds = (schedule) => [
    (schedule.owner._id ?? schedule.owner).toString(),
    ...schedule.collaborators.map((c) => (c.user._id ?? c.user).toString()),
];

// Logs a change on the schedule and tells everyone else on it. Call before `schedule.save()`.
// Returns a function to run after the save (it sends the notifications), so a failed save
// never announces something that didn't happen.
const recordChange = async (schedule, actorId, summary) => {
    if (!isLive(schedule)) return async () => {};
    const actor = await userModel.findById(actorId).select('name');
    const name = actor?.name || 'Someone';
    schedule.activity.push({ user: actorId, userName: name, summary: summary.slice(0, 200) });
    if (schedule.activity.length > MAX_ACTIVITY) schedule.activity.splice(0, schedule.activity.length - MAX_ACTIVITY);
    return async () => {
        await notify({
            recipients: memberIds(schedule),
            sender: actorId,
            type: 'schedule_change',
            title: `"${schedule.title}" was changed`,
            message: `${name} ${summary}`,
            link: `/schedule?s=${schedule._id}`,
            collapseLink: true,
        });
    };
};

const describeEntry = (entry) => `"${entry.title}"`;

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

// Everyone with schedules has exactly one main. Accounts from before that rule may have several
// and none marked, so the oldest one is promoted the first time it matters.
const ensureMainSchedule = async (userId) => {
    const owned = await scheduleModel.find({ owner: userId }).select('isMain createdAt').sort({ createdAt: 1 });
    if (!owned.length) return null;
    const mains = owned.filter((s) => s.isMain);
    if (mains.length === 1) return mains[0]._id;
    const keep = mains[0] || owned[0];
    await scheduleModel.updateMany({ owner: userId, _id: { $ne: keep._id } }, { isMain: false });
    await scheduleModel.updateOne({ _id: keep._id }, { isMain: true, countInWorkload: true });
    return keep._id;
};

const PERSON_FIELDS = 'name avatar profileTag';

const serialize = async (schedule, role, viewerId = '') => {
    await schedule.populate([
        { path: 'owner', select: PERSON_FIELDS },
        { path: 'collaborators.user', select: PERSON_FIELDS },
    ]);
    const plain = schedule.toObject();
    plain.role = role;
    plain.live = isLive(schedule);
    // Only the owner manages sharing, so nobody else needs to see the code.
    if (role !== 'owner') {
        delete plain.shareCode;
        delete plain.shareRole;
        // Members of a live schedule can see who else edits it. Plain viewers stay private.
        plain.collaborators = plain.live ? plain.collaborators.filter((c) => c.role === 'editor') : [];
        if (!plain.live) plain.activity = [];
        plain.myCountInWorkload = schedule.collaborators.find((c) => (c.user._id ?? c.user).toString() === viewerId)?.countInWorkload === true;
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
    isMain: Boolean(schedule.isMain),
    countInWorkload: role === 'owner'
        ? schedule.countInWorkload !== false
        : schedule.collaborators.find((c) => c.user.toString() === userId)?.countInWorkload === true,
    live: isLive(schedule),
    entryCount: schedule.entries.length,
    collaboratorCount: schedule.collaborators.length,
    updatedAt: schedule.updatedAt,
});

const isRealDate = (value) => {
    if (!DATE_RE.test(value)) return false;
    const d = new Date(`${value}T00:00:00Z`);
    return d.toISOString().slice(0, 10) === value;
};

// Returns { entry } with cleaned fields, or { error } describing what's wrong.
const cleanEntry = (body = {}) => {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return { error: 'A title is required.' };
    if (title.length > 80) return { error: 'The title is too long (80 characters max).' };

    const kind = ENTRY_KINDS.includes(body.kind) ? body.kind : 'class';
    if (kind === 'exam' && !body.date) return { error: 'An exam needs a date.' };

    if (!TIME_RE.test(body.startTime || '') || !TIME_RE.test(body.endTime || '')) {
        return { error: 'Start and end times are required.' };
    }
    if (body.endTime <= body.startTime) return { error: 'The end time must be after the start time.' };

    const entry = {
        title,
        kind,
        startTime: body.startTime,
        endTime: body.endTime,
        days: [],
        date: '',
        startDate: '',
        endDate: '',
        location: String(body.location || '').trim().slice(0, 80),
        notes: String(body.notes || '').trim().slice(0, 300),
        color: '',
        icon: '',
        image: '',
        skipOnHoliday: body.skipOnHoliday === undefined ? kind === 'class' : Boolean(body.skipOnHoliday),
        prepHours: 0,
    };

    if (kind === 'exam') {
        const prep = body.prepHours === undefined || body.prepHours === '' ? DEFAULT_PREP_HOURS : Number(body.prepHours);
        if (!Number.isFinite(prep) || prep < 0 || prep > 40) return { error: 'Study hours for an exam can be 0 to 40.' };
        entry.prepHours = Math.round(prep * 2) / 2;
    }

    if (body.date) {
        if (!isRealDate(body.date)) return { error: 'That date is not valid.' };
        entry.date = body.date;
    } else {
        const days = [...new Set((body.days || []).map(Number))];
        if (!days.length || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
            return { error: 'Pick at least one day, or set a specific date.' };
        }
        entry.days = days.sort((a, b) => a - b);
        for (const field of ['startDate', 'endDate']) {
            if (body[field]) {
                if (!isRealDate(body[field])) return { error: 'That date is not valid.' };
                entry[field] = body[field];
            }
        }
        if (entry.startDate && entry.endDate && entry.endDate < entry.startDate) {
            return { error: 'The end date must be after the start date.' };
        }
    }

    if (body.color) {
        if (!COLOR_RE.test(body.color)) return { error: 'That color is not valid.' };
        entry.color = body.color;
    }
    if (body.icon) {
        if (!ICON_RE.test(body.icon)) return { error: 'That icon is not valid.' };
        entry.icon = body.icon;
    }
    if (body.image) {
        if (!IMAGE_RE.test(body.image)) return { error: 'The picture must be a JPEG, PNG, or WebP image.' };
        if (body.image.length > MAX_IMAGE_LENGTH) return { error: 'That picture is too large. Try a smaller one.' };
        entry.image = body.image;
    }
    return { entry };
};

export const createSchedule = async (req, res) => {
    try {
        const title = String(req.body.title || '').trim();
        if (!title) return fail(res, 400, 'Give your schedule a name.');
        if (title.length > 80) return fail(res, 400, 'That name is too long (80 characters max).');
        if (req.body.theme && !SCHEDULE_THEMES.includes(req.body.theme)) return fail(res, 400, 'Unknown theme.');
        const country = req.body.country ? String(req.body.country).toUpperCase() : undefined;
        if (country && !/^[A-Z]{2}$/.test(country)) return fail(res, 400, 'Unknown country code.');

        await ensureMainSchedule(req.userId);
        const ownedCount = await scheduleModel.countDocuments({ owner: req.userId });
        if (ownedCount >= MAX_OWNED_SCHEDULES) {
            return fail(res, 400, `You can have a main schedule and up to ${MAX_OWNED_SCHEDULES - 1} extra ones.`);
        }

        // The first schedule is the main one. Anything after that is an extra.
        const schedule = await scheduleModel.create({
            title,
            owner: req.userId,
            isMain: ownedCount === 0,
            ...(req.body.theme && { theme: req.body.theme }),
            ...(country && { country }),
        });
        res.status(201).json({ success: true, schedule: await serialize(schedule, 'owner') });
    } catch (error) {
        fail(res, 500, error.message);
    }
};

export const getSchedules = async (req, res) => {
    try {
        await ensureMainSchedule(req.userId);
        const schedules = await scheduleModel
            .find({ $or: [{ owner: req.userId }, { 'collaborators.user': req.userId }] })
            .populate('owner', PERSON_FIELDS)
            .sort({ updatedAt: -1 });
        res.json({
            success: true,
            schedules: schedules.map((s) => summarize(s, roleOf(s, req.userId), req.userId)),
        });
    } catch (error) {
        fail(res, 500, error.message);
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
        fail(res, 500, error.message);
    }
};

export const getSchedule = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'view');
        if (!loaded) return;
        res.json({ success: true, schedule: await serialize(loaded.schedule, loaded.role, req.userId) });
    } catch (error) {
        fail(res, 500, error.message);
    }
};

export const updateSchedule = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'owner');
        if (!loaded) return;
        const { schedule, role } = loaded;
        const { title, theme, country, countInWorkload, isMain } = req.body;

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
        if (country !== undefined) {
            const code = String(country).toUpperCase();
            if (!/^[A-Z]{2}$/.test(code)) return fail(res, 400, 'Unknown country code.');
            schedule.country = code;
        }
        // The main schedule always counts. The toggle is only for extras.
        if (countInWorkload !== undefined && !schedule.isMain) schedule.countInWorkload = Boolean(countInWorkload);
        if (isMain === true && !schedule.isMain) {
            // Only one main at a time: the old one becomes an extra.
            await scheduleModel.updateMany({ owner: req.userId, _id: { $ne: schedule._id } }, { isMain: false });
            schedule.isMain = true;
            schedule.countInWorkload = true;
        }
        await schedule.save();
        res.json({ success: true, schedule: await serialize(schedule, role) });
    } catch (error) {
        fail(res, 500, error.message);
    }
};

export const deleteSchedule = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'owner');
        if (!loaded) return;
        if (loaded.schedule.isMain && await scheduleModel.exists({ owner: req.userId, _id: { $ne: loaded.schedule._id } })) {
            return fail(res, 400, 'This is your main schedule. Make another one your main first, then delete this one.');
        }
        const { schedule } = loaded;
        const others = schedule.collaborators.map((c) => c.user.toString());
        const title = schedule.title;
        const wasLive = isLive(schedule);
        await schedule.deleteOne();
        if (wasLive) {
            const owner = await userModel.findById(req.userId).select('name');
            await notify({
                recipients: others, sender: req.userId, type: 'schedule_change',
                title: 'A shared schedule was deleted', message: `${owner?.name || 'The owner'} deleted "${title}".`,
            });
        }
        res.json({ success: true, message: 'Schedule deleted' });
    } catch (error) {
        fail(res, 500, error.message);
    }
};

export const addEntry = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'edit');
        if (!loaded) return;
        const { schedule, role } = loaded;

        const { entry, error } = cleanEntry(req.body);
        if (error) return fail(res, 400, error);
        if (schedule.entries.length >= MAX_ENTRIES) {
            return fail(res, 400, `A schedule can hold up to ${MAX_ENTRIES} entries.`);
        }
        schedule.entries.push(entry);
        const announce = await recordChange(schedule, req.userId, `added ${describeEntry(entry)}`);
        await schedule.save();
        await announce();
        res.status(201).json({ success: true, schedule: await serialize(schedule, role, req.userId) });
    } catch (error) {
        fail(res, 500, error.message);
    }
};

export const updateEntry = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'edit');
        if (!loaded) return;
        const { schedule, role } = loaded;

        const existing = schedule.entries.id(req.params.entryId);
        if (!existing) return fail(res, 404, 'Entry not found');

        const { entry, error } = cleanEntry(req.body);
        if (error) return fail(res, 400, error);
        const renamed = existing.title !== entry.title ? ` (was "${existing.title}")` : '';
        existing.set(entry);
        const announce = await recordChange(schedule, req.userId, `edited ${describeEntry(entry)}${renamed}`);
        await schedule.save();
        await announce();
        res.json({ success: true, schedule: await serialize(schedule, role, req.userId) });
    } catch (error) {
        fail(res, 500, error.message);
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
        existing.deleteOne();
        const announce = await recordChange(schedule, req.userId, `removed ${describeEntry({ title: removedTitle })}`);
        await schedule.save();
        await announce();
        res.json({ success: true, schedule: await serialize(schedule, role, req.userId) });
    } catch (error) {
        fail(res, 500, error.message);
    }
};

// GET /api/schedules/holidays?year=2026&country=PH
export const getHolidays = async (req, res) => {
    try {
        const year = Number(req.query.year);
        const country = String(req.query.country || '').toUpperCase();
        if (!Number.isInteger(year) || year < 1970 || year > 2100) return fail(res, 400, 'Pick a valid year.');
        if (!/^[A-Z]{2}$/.test(country)) return fail(res, 400, 'Unknown country code.');

        const holidays = await fetchPublicHolidays(year, country);
        res.json({ success: true, holidays });
    } catch {
        // The schedule still works without the list (users can add their own days off),
        // so this is a soft failure the client can show as a notice.
        fail(res, 502, "Couldn't load public holidays right now.");
    }
};

// PUT /api/schedules/:scheduleId/holidays  { date, state: 'holiday' | 'workday' | null, name? }
// A null state removes the override, which puts the day back to whatever the
// public holiday list says.
export const setHolidayOverride = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'edit');
        if (!loaded) return;
        const { schedule, role } = loaded;
        const { date, state } = req.body;

        if (!isRealDate(date || '')) return fail(res, 400, 'That date is not valid.');
        if (state !== null && !['holiday', 'workday'].includes(state)) return fail(res, 400, 'Unknown holiday state.');

        const index = schedule.holidayOverrides.findIndex((o) => o.date === date);
        if (state === null) {
            if (index !== -1) schedule.holidayOverrides.splice(index, 1);
        } else {
            const name = String(req.body.name || '').trim().slice(0, 80);
            const override = { date, state, name: state === 'holiday' ? name : '' };
            if (index === -1) schedule.holidayOverrides.push(override);
            else schedule.holidayOverrides.set(index, override);
        }
        const announce = await recordChange(
            schedule, req.userId,
            state === null ? `reset the day off on ${date}` : state === 'holiday' ? `marked ${date} as a day off` : `marked ${date} as a normal day`,
        );
        await schedule.save();
        await announce();
        res.json({ success: true, schedule: await serialize(schedule, role, req.userId) });
    } catch (error) {
        fail(res, 500, error.message);
    }
};

// ---- Copying someone else's schedule ----------------------------------------------
// Works like sharing a task: the person copies a share code (or taps a schedule a
// groupmate posted in chat), sees what is in it and what clashes with their own week,
// and adds it to a schedule of their own. Nothing is shared live, the copy is theirs.

const PLAIN_ENTRY_FIELDS = [
    'title', 'kind', 'days', 'date', 'startDate', 'endDate', 'startTime', 'endTime',
    'location', 'notes', 'color', 'icon', 'skipOnHoliday', 'prepHours',
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
            title: plain.title, ownerName: plain.owner?.name || '', theme: plain.theme, country: plain.country,
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
            title: snap.title, ownerName: snap.ownerName, theme: snap.theme, country: snap.country,
            entries: snap.entries.map((e) => ({ ...e, image: '' })),
        };
    }

    const code = String(shareCode || '').trim().toUpperCase();
    if (!code) {
        fail(res, 400, 'Please enter a share code.');
        return null;
    }
    const schedule = await scheduleModel.findOne({ shareCode: code }).populate('owner', 'name');
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
        title: plain.title, ownerName: plain.owner?.name || '', theme: plain.theme, country: plain.country,
        entries: plain.entries,
        canJoinLive: plain.shareRole === 'editor',
    };
};

const ownedForImport = async (userId) => {
    await ensureMainSchedule(userId);
    return scheduleModel.find({ owner: userId }).select('title entries countInWorkload isMain importedFrom').sort({ isMain: -1, createdAt: 1 }).lean();
};

// POST /api/schedules/preview  { shareCode } or { groupId, messageId }
// What is in the schedule, plus the caller's own entries so the client can point out clashes
// (and re-check them live as the person edits a time before adding).
export const previewImport = async (req, res) => {
    try {
        const source = await loadImportSource(req, res);
        if (!source) return;

        const owned = await ownedForImport(req.userId);
        res.json({
            success: true,
            source: {
                title: source.title, ownerName: source.ownerName, theme: source.theme, country: source.country,
                alreadyAdded: owned.some((s) => (s.importedFrom || []).includes(source.token)),
                canJoinLive: Boolean(source.canJoinLive),
            },
            entries: source.entries.map((e) => ({
                ..._pick(e, ['_id', ...PLAIN_ENTRY_FIELDS]),
                hasImage: Boolean(e.image),
            })),
            // Only the schedules that count toward the caller's week can clash with it.
            existing: owned
                .filter((s) => s.isMain || s.countInWorkload !== false)
                .flatMap((s) => s.entries.map((entry) => ({
                    scheduleId: s._id,
                    scheduleTitle: s.title,
                    entry: _pick(entry, ['_id', ...PLAIN_ENTRY_FIELDS]),
                }))),
            schedules: owned.map((s) => ({ _id: s._id, title: s.title, isMain: Boolean(s.isMain), entryCount: s.entries.length })),
        });
    } catch (error) {
        fail(res, 500, error.message);
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

        // By default the entries go into the caller's main schedule. They can pick one of their
        // extras, or ask for a new extra (newSchedule). With no schedule at all, the copy becomes the main one.
        await ensureMainSchedule(req.userId);
        let schedule;
        if (req.body.targetScheduleId) {
            if (!mongoose.Types.ObjectId.isValid(req.body.targetScheduleId)) return fail(res, 404, 'Schedule not found');
            schedule = await scheduleModel.findOne({ _id: req.body.targetScheduleId, owner: req.userId });
            if (!schedule) return fail(res, 404, 'Schedule not found');
        } else {
            const main = req.body.newSchedule ? null : await scheduleModel.findOne({ owner: req.userId, isMain: true });
            if (main) {
                schedule = main;
            } else {
                const ownedCount = await scheduleModel.countDocuments({ owner: req.userId });
                if (ownedCount >= MAX_OWNED_SCHEDULES) {
                    return fail(res, 400, `You can have a main schedule and up to ${MAX_OWNED_SCHEDULES - 1} extra ones.`);
                }
                const title = String(req.body.title || source.title || 'Shared schedule').trim().slice(0, 80) || 'Shared schedule';
                schedule = new scheduleModel({ title, owner: req.userId, isMain: ownedCount === 0, theme: source.theme, country: source.country });
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
        fail(res, 500, error.message);
    }
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

        // The main schedule always counts. Extras count unless the student turned them off.
        await ensureMainSchedule(req.userId);
        const schedules = await scheduleModel
            .find({
                $or: [
                    { owner: req.userId, $or: [{ isMain: true }, { countInWorkload: { $ne: false } }] },
                    // Shared schedules the member chose to count (off unless they turn it on).
                    { collaborators: { $elemMatch: { user: req.userId, countInWorkload: true } } },
                ],
            })
            .lean();

        // One holiday lookup per country and year the week touches. A failed lookup
        // only means public holidays are missing; the timetable itself still counts.
        const wanted = new Set();
        schedules.forEach((s) => {
            [start, end].forEach((iso) => wanted.add(`${s.country}-${iso.slice(0, 4)}`));
        });
        const holidayMap = {};
        await Promise.all([...wanted].map(async (key) => {
            const [country, year] = key.split('-');
            try {
                holidayMap[key] = await fetchPublicHolidays(Number(year), country);
            } catch {
                holidayMap[key] = [];
            }
        }));
        schedules.forEach((s) => {
            s.publicByDate = {};
            [start, end].forEach((iso) => {
                (holidayMap[`${s.country}-${iso.slice(0, 4)}`] || []).forEach((h) => { s.publicByDate[h.date] = h.name; });
            });
        });

        res.json({
            success: true,
            scheduleCount: schedules.length,
            entryCount: schedules.reduce((n, s) => n + s.entries.length, 0),
            days: buildWeekOverview(schedules, start, dayCount),
            // Exams coming up over the next month, so the dashboard can plan study time for them.
            upcomingExams: findUpcomingExams(schedules, start, EXAM_LOOKAHEAD_DAYS),
        });
    } catch (error) {
        fail(res, 500, error.message);
    }
};

const areFriends = async (a, b) => Boolean(await Friend.exists({
    status: 'accepted',
    $or: [{ user: a, friend: b }, { user: b, friend: a }],
}));

// POST /api/schedules/:scheduleId/share  { userId }
export const shareWithFriend = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'owner');
        if (!loaded) return;
        const { schedule } = loaded;
        const { userId } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId)) return fail(res, 404, 'User not found');
        if (userId === req.userId) return fail(res, 400, 'This is already your schedule.');
        if (!(await areFriends(req.userId, userId))) return fail(res, 403, 'You can only share with your friends.');

        // 'editor' puts the friend on the live schedule. Anything else is the copy-only share.
        const role = req.body.role === 'editor' ? 'editor' : 'viewer';
        const existing = schedule.collaborators.find((c) => c.user.toString() === userId);
        const sender = await userModel.findById(req.userId).select('name');
        const senderName = sender?.name || 'A friend';
        if (!existing) {
            schedule.collaborators.push({ user: userId, role });
            await notify(role === 'editor' ? {
                recipients: [userId],
                sender: req.userId,
                type: 'schedule_share',
                title: 'You can edit a shared schedule',
                message: `${senderName} added you to the schedule "${schedule.title}". You can change it, and everyone on it is told when you do.`,
                link: `/schedule?s=${schedule._id}`,
            } : {
                recipients: [userId],
                sender: req.userId,
                type: 'schedule_share',
                title: 'Schedule shared with you',
                message: `${senderName} shared the schedule "${schedule.title}" with you. Open it to add it to yours, or just ignore it.`,
                link: `/schedule?share=${schedule._id}`,
            });
        } else if (existing.role !== role) {
            existing.role = role;
            await notify({
                recipients: [userId],
                sender: req.userId,
                type: 'schedule_share',
                title: role === 'editor' ? 'You can now edit a schedule' : 'Your access changed',
                message: role === 'editor'
                    ? `${senderName} let you edit "${schedule.title}".`
                    : `${senderName} changed your access to "${schedule.title}" to view only.`,
                link: `/schedule?s=${schedule._id}`,
            });
        }
        await schedule.save();
        res.json({ success: true, schedule: await serialize(schedule, 'owner') });
    } catch (error) {
        fail(res, 500, error.message);
    }
};

export const removeCollaborator = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'view');
        if (!loaded) return;
        const { schedule, role } = loaded;
        const { userId } = req.params;

        // Owners can remove anyone. Everyone else can only remove themselves (leave).
        if (role !== 'owner' && userId !== req.userId) return fail(res, 403, 'Only the owner can do that');
        const index = schedule.collaborators.findIndex((c) => c.user.toString() === userId);
        if (index === -1) return fail(res, 404, 'That person is not on this schedule');

        const wasEditor = schedule.collaborators[index].role === 'editor';
        schedule.collaborators.splice(index, 1);
        await schedule.save();
        if (wasEditor) {
            const person = await userModel.findById(userId).select('name');
            if (role === 'owner') {
                await notify({
                    recipients: [userId], sender: req.userId, type: 'schedule_share',
                    title: 'Removed from a schedule', message: `You can no longer edit "${schedule.title}".`,
                });
            } else {
                await notify({
                    recipients: [schedule.owner], sender: userId, type: 'schedule_change',
                    title: `"${schedule.title}" was changed`, message: `${person?.name || 'Someone'} left the schedule.`,
                    link: `/schedule?s=${schedule._id}`,
                });
            }
        }
        res.json({
            success: true,
            ...(role === 'owner' && { schedule: await serialize(schedule, 'owner') }),
        });
    } catch (error) {
        fail(res, 500, error.message);
    }
};

// PUT /api/schedules/:scheduleId/share-code  { enabled, regenerate? }
export const updateShareCode = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'owner');
        if (!loaded) return;
        const { schedule } = loaded;
        const { enabled, regenerate } = req.body;

        // 'editor' codes put whoever enters them on the live schedule. 'viewer' codes only let them copy it.
        if (req.body.role !== undefined) schedule.shareRole = req.body.role === 'editor' ? 'editor' : 'viewer';
        if (enabled === false) {
            schedule.shareCode = undefined;
        } else if (enabled === true || regenerate) {
            if (!schedule.shareCode || regenerate) schedule.shareCode = await createUniqueShareCode();
        }
        await schedule.save();
        res.json({ success: true, schedule: await serialize(schedule, 'owner') });
    } catch (error) {
        fail(res, 500, error.message);
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
        fail(res, 500, error.message);
    }
};

// POST /api/schedules/join  { shareCode }
export const joinByCode = async (req, res) => {
    try {
        const shareCode = String(req.body.shareCode || '').trim().toUpperCase();
        if (!shareCode) return fail(res, 400, 'Please enter a share code.');

        const schedule = await scheduleModel.findOne({ shareCode });
        if (!schedule) return fail(res, 404, 'No schedule found with that code.');

        let role = roleOf(schedule, req.userId);
        if (!role) {
            role = schedule.shareRole === 'editor' ? 'editor' : 'viewer';
            schedule.collaborators.push({ user: req.userId, role });
            const person = await userModel.findById(req.userId).select('name');
            await notify({
                recipients: [schedule.owner], sender: req.userId, type: 'schedule_change',
                title: `"${schedule.title}" was changed`,
                message: `${person?.name || 'Someone'} joined with the share code${role === 'editor' ? ' and can edit it' : ''}.`,
                link: `/schedule?s=${schedule._id}`, collapseLink: true,
            });
            await schedule.save();
        }
        res.json({ success: true, schedule: await serialize(schedule, role, req.userId) });
    } catch (error) {
        fail(res, 500, error.message);
    }
};

// POST /api/schedules/:scheduleId/duplicate: anyone who can view gets their own editable copy.
export const duplicateSchedule = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'view');
        if (!loaded) return;
        const { schedule } = loaded;

        await ensureMainSchedule(req.userId);
        const ownedCount = await scheduleModel.countDocuments({ owner: req.userId });
        if (ownedCount >= MAX_OWNED_SCHEDULES) {
            return fail(res, 400, `You can have a main schedule and up to ${MAX_OWNED_SCHEDULES - 1} extra ones.`);
        }
        const source = schedule.toObject();
        const copy = await scheduleModel.create({
            isMain: ownedCount === 0,
            title: `${source.title} (copy)`.slice(0, 80),
            owner: req.userId,
            theme: source.theme,
            country: source.country,
            entries: source.entries.map(({ _id, ...rest }) => rest),
            holidayOverrides: source.holidayOverrides,
            // A copy of someone else's timetable is usually the user's own week too.
            countInWorkload: true,
        });
        res.status(201).json({ success: true, schedule: await serialize(copy, 'owner') });
    } catch (error) {
        fail(res, 500, error.message);
    }
};
