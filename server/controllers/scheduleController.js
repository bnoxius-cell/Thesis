import crypto from 'crypto';
import mongoose from 'mongoose';
import scheduleModel, { SCHEDULE_THEMES, MAX_ENTRIES, MAX_IMAGE_LENGTH } from '../models/scheduleModel.js';
import Friend from '../models/Friend.js';
import { notify } from '../utils/notify.js';
import userModel from '../models/userModel.js';
import { fetchPublicHolidays } from '../utils/holidays.js';

const MAX_OWNED_SCHEDULES = 20;
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
    const collab = schedule.collaborators.find((c) => c.user.toString() === userId);
    return collab ? collab.role : null;
};

const CAN = {
    view: ['owner', 'editor', 'viewer'],
    edit: ['owner', 'editor'],
    owner: ['owner'],
};

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

const serialize = async (schedule, role) => {
    await schedule.populate([
        { path: 'owner', select: PERSON_FIELDS },
        { path: 'collaborators.user', select: PERSON_FIELDS },
    ]);
    const plain = schedule.toObject();
    plain.role = role;
    // Only the owner manages sharing, so nobody else needs to see the code.
    if (role !== 'owner') {
        delete plain.shareCode;
        delete plain.shareRole;
        plain.collaborators = [];
    }
    return plain;
};

// Lighter than `serialize`: skips the (heavy) entries, for the list view.
const summarize = (schedule, role) => ({
    _id: schedule._id,
    title: schedule.title,
    theme: schedule.theme,
    owner: schedule.owner,
    role,
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

    const kind = body.kind === 'activity' ? 'activity' : 'class';

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
    };

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

        if (await scheduleModel.countDocuments({ owner: req.userId }) >= MAX_OWNED_SCHEDULES) {
            return fail(res, 400, `You can have up to ${MAX_OWNED_SCHEDULES} schedules.`);
        }

        const schedule = await scheduleModel.create({
            title,
            owner: req.userId,
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
        const schedules = await scheduleModel
            .find({ $or: [{ owner: req.userId }, { 'collaborators.user': req.userId }] })
            .populate('owner', PERSON_FIELDS)
            .sort({ updatedAt: -1 });
        res.json({
            success: true,
            schedules: schedules.map((s) => summarize(s, roleOf(s, req.userId))),
        });
    } catch (error) {
        fail(res, 500, error.message);
    }
};

export const getSchedule = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'view');
        if (!loaded) return;
        res.json({ success: true, schedule: await serialize(loaded.schedule, loaded.role) });
    } catch (error) {
        fail(res, 500, error.message);
    }
};

export const updateSchedule = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'edit');
        if (!loaded) return;
        const { schedule, role } = loaded;
        const { title, theme, country } = req.body;

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
        await loaded.schedule.deleteOne();
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
        await schedule.save();
        res.status(201).json({ success: true, schedule: await serialize(schedule, role) });
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
        existing.set(entry);
        await schedule.save();
        res.json({ success: true, schedule: await serialize(schedule, role) });
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
        existing.deleteOne();
        await schedule.save();
        res.json({ success: true, schedule: await serialize(schedule, role) });
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
        await schedule.save();
        res.json({ success: true, schedule: await serialize(schedule, role) });
    } catch (error) {
        fail(res, 500, error.message);
    }
};

const areFriends = async (a, b) => Boolean(await Friend.exists({
    status: 'accepted',
    $or: [{ user: a, friend: b }, { user: b, friend: a }],
}));

// POST /api/schedules/:scheduleId/share  { userId, role }
export const shareWithFriend = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'owner');
        if (!loaded) return;
        const { schedule } = loaded;
        const { userId, role } = req.body;

        if (!['viewer', 'editor'].includes(role)) return fail(res, 400, 'Choose view or edit access.');
        if (!mongoose.Types.ObjectId.isValid(userId)) return fail(res, 404, 'User not found');
        if (userId === req.userId) return fail(res, 400, 'This is already your schedule.');
        if (!(await areFriends(req.userId, userId))) return fail(res, 403, 'You can only share with your friends.');

        const existing = schedule.collaborators.find((c) => c.user.toString() === userId);
        if (existing) {
            existing.role = role;
        } else {
            schedule.collaborators.push({ user: userId, role });
            const sender = await userModel.findById(req.userId).select('name');
            await notify({
                recipients: [userId],
                sender: req.userId,
                type: 'schedule_share',
                title: 'Schedule shared with you',
                message: `${sender?.name || 'A friend'} shared the schedule "${schedule.title}" with you.`,
                link: '/schedule',
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

        schedule.collaborators.splice(index, 1);
        await schedule.save();
        res.json({
            success: true,
            ...(role === 'owner' && { schedule: await serialize(schedule, 'owner') }),
        });
    } catch (error) {
        fail(res, 500, error.message);
    }
};

// PUT /api/schedules/:scheduleId/share-code  { enabled, role?, regenerate? }
export const updateShareCode = async (req, res) => {
    try {
        const loaded = await loadSchedule(req, res, 'owner');
        if (!loaded) return;
        const { schedule } = loaded;
        const { enabled, role, regenerate } = req.body;

        if (role !== undefined) {
            if (!['viewer', 'editor'].includes(role)) return fail(res, 400, 'Choose view or edit access.');
            schedule.shareRole = role;
        }
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

// POST /api/schedules/join  { shareCode }
export const joinByCode = async (req, res) => {
    try {
        const shareCode = String(req.body.shareCode || '').trim().toUpperCase();
        if (!shareCode) return fail(res, 400, 'Please enter a share code.');

        const schedule = await scheduleModel.findOne({ shareCode });
        if (!schedule) return fail(res, 404, 'No schedule found with that code.');

        let role = roleOf(schedule, req.userId);
        if (!role) {
            schedule.collaborators.push({ user: req.userId, role: schedule.shareRole });
            await schedule.save();
            role = schedule.shareRole;
        }
        res.json({ success: true, schedule: await serialize(schedule, role) });
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

        if (await scheduleModel.countDocuments({ owner: req.userId }) >= MAX_OWNED_SCHEDULES) {
            return fail(res, 400, `You can have up to ${MAX_OWNED_SCHEDULES} schedules.`);
        }
        const source = schedule.toObject();
        const copy = await scheduleModel.create({
            title: `${source.title} (copy)`.slice(0, 80),
            owner: req.userId,
            theme: source.theme,
            country: source.country,
            entries: source.entries.map(({ _id, ...rest }) => rest),
            holidayOverrides: source.holidayOverrides,
        });
        res.status(201).json({ success: true, schedule: await serialize(copy, 'owner') });
    } catch (error) {
        fail(res, 500, error.message);
    }
};
