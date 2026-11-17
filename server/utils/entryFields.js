import { ENTRY_KINDS, MAX_IMAGE_LENGTH, MAX_MEETING_URL } from '../models/scheduleModel.js';

const DEFAULT_PREP_HOURS = 4;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const ICON_RE = /^[a-z0-9-]{0,30}$/;
const IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

// What makes a class time (as opposed to its title, subject and look).
const CLASS_TIME_FIELDS = ['days', 'date', 'startDate', 'endDate', 'startTime', 'endTime', 'location', 'meetingUrl', 'notes'];

export const pickClassTime = (entry) => Object.fromEntries(
    CLASS_TIME_FIELDS.map((key) => [key, key === 'days' ? [...(entry.days ?? [])] : (entry[key] ?? '')]),
);

export const isRealDate = (value) => {
    if (!DATE_RE.test(value)) return false;
    const d = new Date(`${value}T00:00:00Z`);
    return d.toISOString().slice(0, 10) === value;
};

// Only http(s) links, so a "Join" button can never run script or open an app scheme.
const isWebLink = (value) => {
    try {
        const url = new URL(value);
        return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname);
    } catch {
        return false;
    }
};

// Returns { entry } with cleaned fields, or { error } describing what's wrong.
export const cleanEntry = (body = {}) => {
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
        meetingUrl: '',
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
        const days = [...new Set((Array.isArray(body.days) ? body.days : []).map(Number))];
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

    const meetingUrl = String(body.meetingUrl || '').trim();
    if (meetingUrl) {
        if (meetingUrl.length > MAX_MEETING_URL) return { error: 'That meeting link is too long.' };
        if (!isWebLink(meetingUrl)) return { error: 'The meeting link has to be a full web address, like https://meet.google.com/abc-defg-hij.' };
        entry.meetingUrl = meetingUrl;
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
