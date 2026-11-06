// The money part of file storage (plan 18, 3.4). Every upload and every handed-out link first
// reserves its cost here with one conditional MongoDB update that has the cap inside its filter,
// so two requests can never both take the last unit. Reservations are never refunded, except
// storage, which is given back only after the objects are really deleted (storedFiles.js).
import fileUsageModel from '../models/fileUsageModel.js';
import fileUserDayModel from '../models/fileUserDayModel.js';
import userModel from '../models/userModel.js';
import { filesAvailability, getFileLimits } from './fileLimits.js';
import { sendOwnerAlertEmail } from './emailService.js';

const MIB = 1024 * 1024;
export const STORAGE_ID = 'storage';
const RESUME_ID = 'resume';
const ALERT_THRESHOLDS = [50, 80, 100];

// Month and day keys are UTC, from an injected `now` so tests can cross a boundary.
export const monthId = (now) => `month:${now.toISOString().slice(0, 7)}`;
const dayKey = (now) => now.toISOString().slice(0, 10);
export const monthStart = (now) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
export const nextMonthStart =(now) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

// "December 1", in Philippine time, for the student-facing pause messages.
const monthDay = (date) => new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'Asia/Manila' }).format(date);
const megabytes = (bytes) => Math.round(bytes / MIB);

// What a student sees when a file action is refused (plan 18, 3.7). `code` is what the client
// branches on; the message is plain and never mentions Cloudflare, R2 or the caps.
const ERRORS = {
    files_off: { status: 503, code: 'files_off', message: () => "Files aren't available right now. Everything else still works." },
    uploads_paused: {
        status: 503,
        code: 'files_paused',
        message: ({ resumesAt }) => `File uploads are paused until ${monthDay(resumesAt)} so StressCare stays free. You can still open your files.`,
    },
    links_paused: {
        status: 503,
        code: 'files_paused',
        message: ({ resumesAt }) => `Files can't be opened until ${monthDay(resumesAt)} so StressCare stays free. They're safe and will be back then.`,
    },
    links_paused_check: { status: 503, code: 'files_paused', message: () => "Files can't be opened right now. Try again in a little while." },
    storage_full: { status: 503, code: 'storage_full', message: () => "StressCare's shared file space is full right now. Try again later." },
    quota_full: {
        status: 413,
        code: 'quota_full',
        message: () => `You've used your ${megabytes(getFileLimits().userStorageBytes)} MB. Delete a file to make room.`,
    },
    too_big: { status: 413, code: 'too_big', message: () => `That file is too big. The limit is ${megabytes(getFileLimits().maxFileBytes)} MB.` },
    daily_uploads: { status: 429, code: 'daily_limit', message: () => "You've sent a lot of files today. You can send more tomorrow." },
    daily_links: { status: 429, code: 'daily_limit', message: () => "You've opened a lot of files today. Try again tomorrow." },
    slow_down: { status: 429, code: 'slow_down', message: () => 'Slow down a little.' },
    busy: { status: 503, code: 'busy', message: () => 'Busy, try again in a moment.' },
    bad_type: {
        status: 400,
        code: 'bad_type',
        message: () => "This kind of file can't be sent. Try a photo, PDF, Word, PowerPoint, Excel or text file.",
    },
    bad_upload: { status: 400, code: 'bad_upload', message: () => "The upload didn't go through. Try again." },
    store_failed: { status: 502, code: 'store_failed', message: () => "Couldn't save the file. Try again." },
    too_many: { status: 400, code: 'too_many', message: () => `Ask for ${getFileLimits().maxLinksPerRequest} files or fewer at a time.` },
    not_found: { status: 404, code: 'not_found', message: () => 'File not found.' },
    too_many_files: {
        status: 409,
        code: 'too_many_files',
        message: () => `You have ${getFileLimits().maxLibraryFiles} files. Delete some to add more.`,
    },
};

export class FileLimitError extends Error {
    constructor({ status, code, message, resumesAt = null }) {
        super(message);
        this.name = 'FileLimitError';
        this.status = status;
        this.code = code;
        this.resumesAt = resumesAt;
    }
}

// `kind` is a key of ERRORS; `resumesAt` only for the paused kinds that name a date.
export const fileError = (kind, { resumesAt = null } = {}) => {
    const { status, code, message } = ERRORS[kind];
    return new FileLimitError({ status, code, message: message({ resumesAt }), resumesAt });
};

// Every reservation and release takes a whole number, zero or more. A negative amount would hand budget back.
const assertAmount = (amount) => {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new TypeError('amount must be a whole number, zero or more');
};

// Two concurrent upserts can both try to insert; the loser's duplicate key error is harmless.
const ensureDoc = async (model, filter, insert) => {
    try {
        await model.updateOne(filter, { $setOnInsert: insert }, { upsert: true });
    } catch (error) {
        if (error.code !== 11000) throw error;
    }
};

const ensureUsageDoc = (id) => ensureDoc(fileUsageModel, { _id: id }, {
    bytes: 0, classA: 0, classB: 0, uploadBytes: 0, alerts: [], 'tripped.reads': '', 'tripped.writes': '',
});

// --- Alerts (plan 18, 3.11) ---

// For trips and other one-off owner warnings (FS0e uses it too). Never awaits the mail, never throws.
export const sendFileAlert = (subject, text) => {
    const to = getFileLimits().alertEmail;
    console.warn(`[files] alert: ${subject}`);
    if (!to) return;
    sendOwnerAlertEmail(to, `StressCare files: ${subject}`, text)
        .catch((error) => console.error('[files] alert email failed:', error.message));
};

// Records each threshold a counter has passed on this month's document, once (the conditional
// $addToSet decides who sends), and emails the highest one that is new.
const checkAlerts = async (id, readings) => {
    try {
        for (const { name, used, cap } of readings) {
            const passed = ALERT_THRESHOLDS.filter((percent) => used * 100 >= cap * percent);
            let newest = 0;
            for (const percent of passed) {
                const { modifiedCount } = await fileUsageModel.updateOne(
                    { _id: id, alerts: { $ne: `${name}:${percent}` } },
                    { $addToSet: { alerts: `${name}:${percent}` } },
                );
                if (modifiedCount) newest = percent;
            }
            if (newest) {
                sendFileAlert(`${name} passed ${newest}% of its cap`, `${name} is at ${used} of ${cap} for ${id.slice(6)} (UTC).`);
            }
        }
    } catch (error) {
        console.error('[files] alert check failed:', error.message);
    }
};

// --- Reservations ---

// Atomic: the student's storage can't pass their quota however many uploads race. A student who
// signed up before files existed has no storageUsedBytes yet, which counts as 0.
export const reserveUserStorage = async (userId, bytes) => {
    assertAmount(bytes);
    const room = getFileLimits().userStorageBytes - bytes;
    if (room < 0) throw fileError('quota_full');
    const user = await userModel.findOneAndUpdate(
        { _id: userId, $or: [{ storageUsedBytes: { $lte: room } }, { storageUsedBytes: { $exists: false } }] },
        { $inc: { storageUsedBytes: bytes } },
        { returnDocument: 'after', projection: { storageUsedBytes: 1 } },
    );
    if (!user) throw fileError('quota_full');
};

export const reserveGlobalStorage = async (bytes, now = new Date()) => {
    assertAmount(bytes);
    const { storageCapBytes } = getFileLimits();
    await ensureUsageDoc(STORAGE_ID);
    const doc = await fileUsageModel.findOneAndUpdate(
        { _id: STORAGE_ID, bytes: { $lte: storageCapBytes - bytes } },
        { $inc: { bytes } },
        { returnDocument: 'after' },
    );
    if (!doc) throw fileError('storage_full');
    const id = monthId(now);
    await ensureUsageDoc(id);
    await checkAlerts(id, [{ name: 'storage', used: doc.bytes, cap: storageCapBytes }]);
};

// Pipeline updates so a release can never take a counter below 0 (counters may drift high, never low).
const minusClamped = (path, bytes) => ({ $max: [0, { $subtract: [{ $ifNull: [path, 0] }, bytes] }] });

export const releaseUserStorage = async (userId, bytes) => {
    assertAmount(bytes);
    await userModel.updateOne(
        { _id: userId },
        [{ $set: { storageUsedBytes: minusClamped('$storageUsedBytes', bytes) } }],
        { updatePipeline: true },
    );
};

export const releaseGlobalStorage = async (bytes) => {
    assertAmount(bytes);
    await fileUsageModel.updateOne(
        { _id: STORAGE_ID },
        [{ $set: { bytes: minusClamped('$bytes', bytes) } }],
        { updatePipeline: true },
    );
};

// Monthly R2 operations and upload traffic. The caps and the trips are in the same filter, so a
// trip blocks at once and nothing is taken when the reservation doesn't fit.
export const reserveMonth = async ({ classA = 0, classB = 0, uploadBytes = 0 }, now = new Date()) => {
    assertAmount(classA);
    assertAmount(classB);
    assertAmount(uploadBytes);
    const { classAMonthlyCap, classBMonthlyCap, uploadMonthlyBytes } = getFileLimits();
    const id = monthId(now);
    await ensureUsageDoc(id);

    // Only the counters this reservation takes, so a full upload budget never blocks links and the
    // other way round.
    const filter = { _id: id };
    if (classA > 0) Object.assign(filter, { classA: { $lte: classAMonthlyCap - classA }, 'tripped.writes': '' });
    if (classB > 0) Object.assign(filter, { classB: { $lte: classBMonthlyCap - classB }, 'tripped.reads': '' });
    if (uploadBytes > 0) filter.uploadBytes = { $lte: uploadMonthlyBytes - uploadBytes };
    const doc = await fileUsageModel.findOneAndUpdate(filter, { $inc: { classA, classB, uploadBytes } }, { returnDocument: 'after' });

    if (!doc) {
        const writing = classA > 0 || uploadBytes > 0;
        const current = await fileUsageModel.findById(id).lean();
        const reason = (writing ? current?.tripped?.writes : current?.tripped?.reads) || 'cap';
        console.warn(`[files] ${writing ? 'upload' : 'link'} refused for ${id}: ${reason}`);
        if (reason === 'analytics_down') throw fileError('links_paused_check');
        throw fileError(writing ? 'uploads_paused' : 'links_paused', { resumesAt: nextMonthStart(now) });
    }

    await checkAlerts(id, [
        classA > 0 && { name: 'classA', used: doc.classA, cap: classAMonthlyCap },
        classB > 0 && { name: 'classB', used: doc.classB, cap: classBMonthlyCap },
        uploadBytes > 0 && { name: 'upload', used: doc.uploadBytes, cap: uploadMonthlyBytes },
    ].filter(Boolean));
    return doc;
};

// Durable daily limits per student. A link reservation that doesn't fit says so in link words.
export const reserveUserDay = async (userId, { uploads = 0, uploadBytes = 0, links = 0 }, now = new Date()) => {
    [uploads, uploadBytes, links].forEach(assertAmount);
    const { uploadsPerDay, uploadBytesPerDay, linksPerDay } = getFileLimits();
    const day = dayKey(now);
    await ensureDoc(fileUserDayModel, { user: userId, day }, { uploads: 0, uploadBytes: 0, links: 0, createdAt: now });
    const doc = await fileUserDayModel.findOneAndUpdate(
        {
            user: userId,
            day,
            uploads: { $lte: uploadsPerDay - uploads },
            uploadBytes: { $lte: uploadBytesPerDay - uploadBytes },
            links: { $lte: linksPerDay - links },
        },
        { $inc: { uploads, uploadBytes, links } },
        { returnDocument: 'after' },
    );
    if (!doc) throw fileError(links > 0 ? 'daily_links' : 'daily_uploads');
};

// Upload order (3.4): student's day, student's storage, server storage, month last. Storage taken
// by an earlier step is given back when a later one refuses; daily counters are not.
export const reserveUpload = async (userId, { bytes, classA }, now = new Date()) => {
    await reserveUserDay(userId, { uploads: 1, uploadBytes: bytes }, now);
    await reserveUserStorage(userId, bytes);
    try {
        await reserveGlobalStorage(bytes, now);
    } catch (error) {
        await releaseUserStorage(userId, bytes);
        throw error;
    }
    try {
        await reserveMonth({ classA, uploadBytes: bytes }, now);
    } catch (error) {
        await releaseStorage(userId, bytes);
        throw error;
    }
};

// A batch of `count` links is all or nothing: one update per counter.
export const reserveLinks = async (userId, count, now = new Date()) => {
    await reserveUserDay(userId, { links: count }, now);
    await reserveMonth({ classB: count }, now);
};

export const releaseStorage = async (userId, bytes) => {
    await releaseUserStorage(userId, bytes);
    await releaseGlobalStorage(bytes);
};

// --- What the Upload button shows ---

const unavailable = (kind, options) => {
    const { code, message, resumesAt } = fileError(kind, options);
    return { on: false, code, message, ...(resumesAt && { resumesAt }) };
};

// Read-only and approximate: nothing is reserved, and the real check is the reservation inside
// storeFile. Leaves two Class A operations of room (a photo and its preview), so the button
// goes quiet before an upload would be refused for the month.
export const uploadState = async (now = new Date()) => {
    if (!filesAvailability().on) return unavailable('files_off');
    const { classAMonthlyCap, uploadMonthlyBytes, storageCapBytes } = getFileLimits();
    const [storage, month] = await Promise.all([
        fileUsageModel.findById(STORAGE_ID).lean(),
        fileUsageModel.findById(monthId(now)).lean(),
    ]);
    const monthFull = month && (month.tripped?.writes || month.classA > classAMonthlyCap - 2 || month.uploadBytes >= uploadMonthlyBytes);
    if (monthFull) return unavailable('uploads_paused', { resumesAt: nextMonthStart(now) });
    if ((storage?.bytes ?? 0) >= storageCapBytes) return unavailable('storage_full');
    return { on: true };
};

// --- Reconciliation with Cloudflare's numbers (plan 18, 3.14) ---
// These only set and clear trips and store what Cloudflare saw. The reservations above read the
// trips inside their own filters, so a trip set here blocks the next reservation at once.

// Trips one direction (`reads` or `writes`) only if it isn't tripped already, so two runs can't
// both set it or both email. True for the caller that set it.
export const setTrip = async (now, direction, reason) => {
    const id = monthId(now);
    await ensureUsageDoc(id);
    const path = `tripped.${direction}`;
    const { modifiedCount } = await fileUsageModel.updateOne({ _id: id, [path]: '' }, { $set: { [path]: reason } });
    return modifiedCount === 1;
};

// A run that couldn't reach Cloudflare. Returns how many have failed in a row this month, and when
// a run last got numbers: this month's check, or last month's while this month has none yet, so a
// new month doesn't start the hour over. null when there never was one.
export const recordUsageFailure = async (now) => {
    const id = monthId(now);
    await ensureUsageDoc(id);
    const doc = await fileUsageModel.findOneAndUpdate({ _id: id }, { $inc: { analyticsFailures: 1 } }, { returnDocument: 'after', lean: true });
    let lastCheckedAt = doc.real?.checkedAt ?? null;
    if (!lastCheckedAt) {
        const previous = await fileUsageModel.findById(monthId(new Date(monthStart(now).getTime() - 1))).lean();
        lastCheckedAt = previous?.real?.checkedAt ?? null;
    }
    return { failures: doc.analyticsFailures, lastCheckedAt };
};

// A run that reached Cloudflare: stores what it saw, resets the failure count and lifts
// `analytics_down`, the only reason that clears itself (any other reason stays). Returns this
// month's document and the stored bytes we count, for the trip checks.
export const recordRealUsage = async (now, real) => {
    const id = monthId(now);
    await ensureUsageDoc(id);
    await fileUsageModel.updateOne({ _id: id, 'tripped.reads': 'analytics_down' }, { $set: { 'tripped.reads': '' } });
    const [month, storage] = await Promise.all([
        fileUsageModel.findOneAndUpdate(
            { _id: id },
            { $set: { real: { ...real, checkedAt: now }, analyticsFailures: 0 } },
            { returnDocument: 'after', lean: true },
        ),
        fileUsageModel.findById(STORAGE_ID).lean(),
    ]);
    return { month, storageBytes: storage?.bytes ?? 0 };
};

// Owner resume (O10): a FILES_RESUME_KEY that was never applied clears both trips and accepts the
// gap Cloudflare shows right now as the baseline, so it doesn't trip again at once. The last key
// applied lives on its own document, not the month's, so a key left in env applies once ever and
// not again each new month. Claiming the key first (it's in the filter) means two runs can't both
// apply it. Returns the updated month, or null when nothing changed.
export const applyResume = async (now, key, real) => {
    await ensureDoc(fileUsageModel, { _id: RESUME_ID }, { resumeKey: '' });
    const claimed = await fileUsageModel.updateOne({ _id: RESUME_ID, resumeKey: { $ne: key } }, { $set: { resumeKey: key } });
    if (!claimed.modifiedCount) return null;

    const id = monthId(now);
    await ensureUsageDoc(id);
    const month = await fileUsageModel.findById(id).lean();
    const baseline = {
        classA: Math.max(0, real.classA - month.classA),
        classB: Math.max(0, real.classB - month.classB),
    };
    return fileUsageModel.findOneAndUpdate(
        { _id: id },
        { $set: { baseline, 'tripped.reads': '', 'tripped.writes': '' } },
        { returnDocument: 'after', lean: true },
    );
};

// One line for the Render log at each sweep (3.11). Counts only: never a URL, key or signature.
export const logFileUsage = async (now = new Date()) => {
    const { storageCapBytes, classAMonthlyCap, classBMonthlyCap, uploadMonthlyBytes } = getFileLimits();
    const [storage, month] = await Promise.all([
        fileUsageModel.findById(STORAGE_ID).lean(),
        fileUsageModel.findById(monthId(now)).lean(),
    ]);
    const tripped = ['reads', 'writes'].filter((direction) => month?.tripped?.[direction]).join(',') || 'none';
    console.log(
        `[files] usage storage=${megabytes(storage?.bytes ?? 0)}/${megabytes(storageCapBytes)}`
        + ` classA=${month?.classA ?? 0}/${classAMonthlyCap} (real ${month?.real?.classA ?? 0})`
        + ` classB=${month?.classB ?? 0}/${classBMonthlyCap} (real ${month?.real?.classB ?? 0})`
        + ` upload=${megabytes(month?.uploadBytes ?? 0)}/${megabytes(uploadMonthlyBytes)} tripped=${tripped}`,
    );
};
