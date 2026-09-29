import mongoose from 'mongoose';

export const SCHEDULE_THEMES = ['classic', 'cute', 'ocean', 'matcha', 'notebook', 'midnight'];
export const MAX_ENTRIES = 80;
// One main schedule plus a few extras (gym, gaming, a second course load).
export const MAX_OWNED_SCHEDULES = 5;
export const ENTRY_KINDS = ['class', 'activity', 'exam', 'event'];
// Data URLs are stored inline, so this cap (plus MAX_ENTRIES) keeps a schedule
// comfortably under Mongo's 16MB document limit. The client shrinks pictures well below it.
export const MAX_IMAGE_LENGTH = 100 * 1024;

export const entrySchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 80 },
    kind: { type: String, enum: ENTRY_KINDS, default: 'class' },
    // Exams only: hours the student wants to set aside to prepare. The dashboard turns them
    // into study work due on the exam date.
    prepHours: { type: Number, default: 0, min: 0, max: 40 },
    // Recurring entries use `days` (0 = Sunday ... 6 = Saturday, same as Date#getDay).
    // One-off entries use `date` instead. Dates are plain 'YYYY-MM-DD' strings so
    // time zones can't shift them onto the wrong day.
    days: { type: [Number], default: [] },
    date: { type: String, default: '' },
    startDate: { type: String, default: '' },
    endDate: { type: String, default: '' },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    location: { type: String, default: '', maxlength: 80 },
    notes: { type: String, default: '', maxlength: 300 },
    color: { type: String, default: '' },
    icon: { type: String, default: '' },
    image: { type: String, default: '' },
    skipOnHoliday: { type: Boolean, default: true },
});

const holidayOverrideSchema = new mongoose.Schema({
    date: { type: String, required: true },
    // 'holiday' marks (or renames) a day off, 'workday' hides a fetched holiday.
    state: { type: String, enum: ['holiday', 'workday'], required: true },
    name: { type: String, default: '', maxlength: 80 },
}, { _id: false });

// Sharing is view-only now (people copy what they need). 'editor' stays in the enum only
// so older documents still validate; the controller treats it as 'viewer'.
const collaboratorSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    role: { type: String, enum: ['viewer', 'editor'], default: 'viewer' },
}, { _id: false });

const scheduleSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 80 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    theme: { type: String, enum: SCHEDULE_THEMES, default: 'classic' },
    country: { type: String, default: 'PH', uppercase: true, match: /^[A-Z]{2}$/ },
    entries: [entrySchema],
    holidayOverrides: [holidayOverrideSchema],
    collaborators: [collaboratorSchema],
    shareCode: { type: String, unique: true, sparse: true, uppercase: true },
    shareRole: { type: String, enum: ['viewer', 'editor'], default: 'viewer' },
    // The one schedule the whole app is based on. Every user with a schedule has exactly one.
    // Other schedules are extras that are checked against it.
    isMain: { type: Boolean, default: false },
    // Extras only: whether the dashboard counts this timetable when it works out the workload.
    // The main schedule always counts.
    countInWorkload: { type: Boolean, default: true },
    // Where copied entries came from ('schedule:<id>' for a share code, 'message:<id>' for a
    // group chat share), so the chat can show "already added" instead of offering it again.
    importedFrom: { type: [String], default: [] },
}, { timestamps: true });

export default mongoose.models.schedule || mongoose.model('schedule', scheduleSchema);
