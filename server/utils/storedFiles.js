// A stored file's life (plan 18, 3.5): reserve the budget, write the ledger row, put the objects,
// mark it ready; hand out short-lived links; and remove it again, giving storage back only after
// the objects are really gone. The ledger row exists before any object, so nothing is orphaned.
// Also the reconciliation that checks our counters against Cloudflare's own numbers (3.14).
import { createHash, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import fileModel from '../models/fileModel.js';
import { filesAvailability, getFileLimits } from './fileLimits.js';
import { getFileStore } from './fileStore.js';
import { StoreError } from './fileStores/storeError.js';
import { canRead } from './fileAccess.js';
import { contentDisposition } from './fileNames.js';
import { R2UsageError, fetchR2Usage } from './r2Usage.js';
import {
    applyResume, fileError, logFileUsage, monthStart, recordRealUsage, recordUsageFailure, releaseStorage,
    reserveLinks, reserveUpload, sendFileAlert, setTrip,
} from './fileBudget.js';

const MIB = 1024 * 1024;
const HOUR_MS = 60 * 60 * 1000;
const STALE_UPLOAD_MS = HOUR_MS; // a put times out after 15 s, so an hour-old upload is dead
const STALE_USAGE_MS = HOUR_MS; // links fail closed once Cloudflare's numbers are this old
const SWEEP_INTERVAL_MS = HOUR_MS;
const FIRST_SWEEP_MS = 60 * 1000;
const FIRST_RECONCILE_MS = 90 * 1000;
const SWEEP_BATCH = 200;
const REMOVE_FILTER_KEYS = new Set(['_id', 'owner', 'group', 'message', 'subject', 'folder']);

// Only these are shown in the browser; everything else downloads. An explicit list, not
// "image/*", so a type like SVG could never be served inline even if it got past the checks.
const INLINE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const IMAGE_CACHE = 'private, max-age=86400, immutable';
const NO_CACHE = 'private, no-store';

// The headers stored with an object, which R2 sends back on every GET. The signed link covers the
// URL, so a link holder can't change them.
export const objectHeaders = (row, variant = 'file') => {
    const mimeType = variant === 'thumb' ? row.thumbMimeType : row.mimeType;
    const inline = INLINE_TYPES.has(mimeType);
    return {
        'Content-Type': mimeType,
        'Content-Disposition': contentDisposition(row.name, { inline }),
        'Cache-Control': inline ? IMAGE_CACHE : NO_CACHE,
    };
};

// The store while files are on, otherwise null.
const currentStore = () => (filesAvailability().on ? getFileStore() : null);

const activeStore = () => {
    const store = currentStore();
    if (!store) throw fileError('files_off');
    return store;
};

// storageId is "<store>:<key>"; a row made by another store can't be reached from this one.
const keyIn = (store, storageId) => {
    const prefix = `${store.name}:`;
    return storageId?.startsWith(prefix) ? storageId.slice(prefix.length) : null;
};
const newStorageId = (store, kind) => `${store.name}:${kind}/${randomUUID()}`;

// Deletes a `removing` row's objects, then the row, then gives its storage back. Only the caller
// whose deleteOne removed the row releases, so two removers racing can't release twice.
// Returns false (and leaves the row for the sweeper) when an object couldn't be deleted.
const removeRow = async (store, row) => {
    try {
        for (const storageId of [row.storageId, row.thumbStorageId].filter(Boolean)) {
            const key = keyIn(store, storageId);
            if (!key) throw new StoreError('WrongStore', { key: storageId });
            await store.remove(key);
        }
    } catch (error) {
        await fileModel.updateOne({ _id: row._id }, { $inc: { removeAttempts: 1 } });
        console.error(`[files] could not remove file ${row._id}: ${error.message}`);
        return false;
    }
    const { deletedCount } = await fileModel.deleteOne({ _id: row._id, state: 'removing' });
    if (deletedCount) await releaseStorage(row.owner, row.bytes);
    return true;
};

// Gives up on a row: marks it removing and tries to clean up now. Never throws; whatever is left
// is the sweeper's job.
export const discard = async (row) => {
    try {
        await fileModel.updateOne({ _id: row._id }, { $set: { state: 'removing' } });
        const store = currentStore();
        if (store) await removeRow(store, row);
    } catch (error) {
        console.error(`[files] discard failed for file ${row._id}: ${error.message}`);
    }
};

// file: { buffer, name, ext, mimeType, width, height }, already checked by the upload helper.
// thumb: { buffer, mimeType } or null. refs: { group, message } for chat, { subject } or { folder } for the library.
export const storeFile = async ({ ownerId, scope, refs = {}, file, thumb = null, now = new Date() }) => {
    const store = activeStore();
    const bytes = file.buffer.length + (thumb?.buffer.length ?? 0);
    await reserveUpload(ownerId, { bytes, classA: thumb ? 2 : 1 }, now);

    let row;
    try {
        row = await fileModel.create({
            owner: ownerId,
            scope,
            group: refs.group ?? null,
            message: refs.message ?? null,
            subject: refs.subject ?? null,
            folder: refs.folder ?? null,
            name: file.name,
            ext: file.ext,
            mimeType: file.mimeType,
            size: file.buffer.length,
            storageId: newStorageId(store, 'f'),
            thumbStorageId: thumb ? newStorageId(store, 't') : '',
            thumbMimeType: thumb?.mimeType ?? '',
            thumbSize: thumb?.buffer.length ?? 0,
            width: file.width ?? 0,
            height: file.height ?? 0,
            sha256: createHash('sha256').update(file.buffer).digest('hex'),
            bytes,
        });
    } catch (error) {
        await releaseStorage(ownerId, bytes);
        throw error;
    }

    try {
        await store.put(keyIn(store, row.storageId), file.buffer, objectHeaders(row, 'file'));
        if (thumb) await store.put(keyIn(store, row.thumbStorageId), thumb.buffer, objectHeaders(row, 'thumb'));
        // Conditional: if a delete marked the row removing meanwhile, the upload lost.
        const ready = await fileModel.findOneAndUpdate(
            { _id: row._id, state: 'uploading' },
            { $set: { state: 'ready' } },
            { returnDocument: 'after' },
        );
        if (!ready) throw fileError('store_failed');
        return ready;
    } catch (error) {
        await discard(row);
        if (error instanceof StoreError) {
            console.error(`[files] upload failed: ${error.message}`);
            throw fileError('store_failed');
        }
        throw error;
    }
};

// Short-lived read links for rows the caller has already checked access to (fileAccess.canRead).
// All or nothing: every row must be ready, and the whole batch is reserved in one update per
// counter before anything is signed. Signing is local; no request goes to the store.
export const issueFileLinks = async (rows, { variant = 'file', userId, now = new Date() }) => {
    const store = activeStore();
    const { maxLinksPerRequest, linkTtlSeconds } = getFileLimits();
    if (rows.length > maxLinksPerRequest) throw fileError('too_many');
    if (variant !== 'file' && variant !== 'thumb') throw fileError('not_found');

    const keys = rows.map((row) => {
        const key = row.state === 'ready' ? keyIn(store, variant === 'thumb' ? row.thumbStorageId : row.storageId) : null;
        if (!key) throw fileError('not_found');
        return key;
    });
    if (!keys.length) return [];

    await reserveLinks(userId, keys.length, now);
    const expiresAt = new Date(now.getTime() + linkTtlSeconds * 1000);
    return Promise.all(rows.map(async (row, index) => ({
        id: String(row._id),
        url: await store.presignGet(keys[index], { expiresIn: linkTtlSeconds, now: now.getTime() }),
        expiresAt,
    })));
};

// One object, with its length and SHA-256 checked against the ledger. Anything wrong is store_failed.
const readOne = async (store, key, row) => {
    let buffer;
    try {
        buffer = await store.get(key, { maxBytes: row.size });
    } catch (error) {
        if (!(error instanceof StoreError)) throw error;
        console.error(`[files] could not read file ${row._id}: ${error.message}`);
        throw fileError('store_failed');
    }
    const shaMatches = !row.sha256 || createHash('sha256').update(buffer).digest('hex') === row.sha256;
    if (buffer.length !== row.size || !shaMatches) {
        console.error(`[files] file ${row._id} does not match its record`);
        throw fileError('store_failed');
    }
    return buffer;
};

// Reads the bytes of rows the caller owns, for a feature that works on the file itself (a reviewer
// made from Study files). Same rules as a download: canRead on every row, every row ready. The
// whole batch is reserved as links before the first GET and never refunded, so a refusal on any
// row costs nothing and a failed read still counts. Then one GET at a time, each checked against
// the ledger row. Buffers come back in the rows' order.
export const readStoredFiles = async (rows, { userId, now = new Date() }) => {
    const store = activeStore();
    const allowed = await Promise.all(rows.map((row) => canRead(userId, row)));
    const keys = rows.map((row, index) => {
        const key = allowed[index] && row.state === 'ready' ? keyIn(store, row.storageId) : null;
        if (!key) throw fileError('not_found');
        return key;
    });
    if (!keys.length) return [];

    await reserveLinks(userId, keys.length, now);
    const buffers = [];
    for (const [index, row] of rows.entries()) {
        buffers.push(await readOne(store, keys[index], row));
    }
    return buffers;
};

// Removes every file matching `filter` (by owner, group, message, subject, folder or _id). Rows are marked
// removing first, so they stop handing out links at once even when the objects can't be deleted
// yet (files off, or the store failing); the sweeper finishes those later.
export const removeFiles = async (filter) => {
    // Plain ids only, so a value from a request (say { $ne: null }) can never widen the match.
    const entries = Object.entries(filter);
    if (!entries.length || entries.some(([key, value]) => !REMOVE_FILTER_KEYS.has(key) || !mongoose.isObjectIdOrHexString(value))) {
        throw new TypeError('removeFiles needs an id filter on owner, group, message, subject, folder or _id');
    }
    await fileModel.updateMany({ ...filter, state: { $ne: 'removing' } }, { $set: { state: 'removing' } });
    const store = currentStore();
    if (!store) return { removed: 0 };
    const rows = await fileModel.find({ ...filter, state: 'removing' });
    let removed = 0;
    for (const row of rows) {
        if (await removeRow(store, row)) removed += 1;
    }
    return { removed };
};

// Hourly: gives up on dead uploads, retries deletes, logs usage. It never touches the storage
// counters: they can only drift high by design, and the storage_gap trip catches a large gap.
// Only touches rows made by the current store, so a dev server on a shared database can't
// mark production rows.
export const sweepFiles = async (now = new Date()) => {
    const store = currentStore();
    if (!store) return null;
    const ours = { storageId: { $regex: `^${store.name}:` } };

    await fileModel.updateMany(
        { ...ours, state: 'uploading', updatedAt: { $lt: new Date(now.getTime() - STALE_UPLOAD_MS) } },
        { $set: { state: 'removing' } },
    );
    const rows = await fileModel.find({ ...ours, state: 'removing' }).sort({ updatedAt: 1 }).limit(SWEEP_BATCH);
    let removed = 0;
    for (const row of rows) {
        if (await removeRow(store, row)) removed += 1;
    }
    await logFileUsage(now);
    return { removed, failed: rows.length - removed };
};

// The reasons a run of the reconciliation trips each direction, or '' for none (plan 18, 3.14).
// Counted includes the gap an owner resume already accepted (baseline).
const tripsFor = (month, storageBytes) => {
    const limits = getFileLimits();
    const real = month.real;
    const countedA = month.classA + (month.baseline?.classA ?? 0);
    const countedB = month.classB + (month.baseline?.classB ?? 0);
    const readMargin = Math.max(limits.readGapFloor, limits.readGapRatio * countedB);

    let reads = '';
    if (real.classB > countedB + readMargin) reads = 'uncounted_reads';
    else if (real.classB >= limits.tripRealClassB) reads = 'read_line';

    let writes = '';
    if (real.classA > countedA + limits.writeGapMargin || real.classA >= limits.tripRealClassA) writes = 'uncounted_writes';
    else if (real.storageBytes > storageBytes + limits.storageGapBytes) writes = 'storage_gap';
    return { reads, writes };
};

// The owner email for a trip or a resume: the reason plus counted and real numbers. Never a URL,
// a key or a token.
const usageText = (month, storageBytes, lines) => [
    ...lines,
    `Month: ${month._id.slice(6)} (UTC)`,
    `Class B: counted ${month.classB} (plus ${month.baseline?.classB ?? 0} accepted), real ${month.real.classB}`,
    `Class A: counted ${month.classA} (plus ${month.baseline?.classA ?? 0} accepted), real ${month.real.classA}`,
    `Storage: counted ${Math.round(storageBytes / MIB)} MB, real ${Math.round(month.real.storageBytes / MIB)} MB`,
].join('\n');

const TRIP_NOTES = {
    uncounted_reads: 'Cloudflare counts more reads than links we handed out. Links are paused until the month ends.',
    read_line: 'Real reads reached the monthly line. Links are paused until the month ends.',
    uncounted_writes: 'Cloudflare counts writes we never made: a leaked key or a bug. Uploads are paused. Consider the emergency stop (plan 18, 5.7) now.',
    storage_gap: 'Cloudflare holds much more data than we count. Uploads are paused until the month ends.',
};

// Applies a new FILES_RESUME_KEY once (never when it's empty). Returns the resumed month or null.
const resumeIfAsked = async (now, real, storageBytes) => {
    const key = process.env.FILES_RESUME_KEY?.trim();
    if (!key) return null;
    const month = await applyResume(now, key, real);
    if (month) {
        console.warn(`[files] owner resume applied for ${month._id}`);
        sendFileAlert('owner resume applied', usageText(month, storageBytes, ['Both trips are cleared and the current gap is accepted.']));
    }
    return month;
};

// Every 10 minutes while R2 is on: compares our counters with Cloudflare's for this UTC month and
// pauses links or uploads when reality runs ahead (plan 18, 3.14). An hour without numbers
// pauses links too, and the next good run lifts that. Returns what it did, for the tests.
export const reconcileUsage = async (now = new Date(), { fetchImpl } = {}) => {
    const availability = filesAvailability();
    if (!availability.on || availability.store !== 'r2') return null;

    let real;
    try {
        real = await fetchR2Usage({
            accountId: process.env.R2_ACCOUNT_ID,
            token: process.env.CF_ANALYTICS_TOKEN,
            bucket: process.env.R2_BUCKET,
            from: monthStart(now),
            to: now,
            fetchImpl,
        });
    } catch (error) {
        // Only the short code: the request carries the token.
        const code = error instanceof R2UsageError ? error.code : 'unexpected';
        const { failures, lastCheckedAt } = await recordUsageFailure(now);
        console.warn(`[files] usage check failed (${failures} in a row): ${code}`);
        // Six failures in a row is an hour of this process trying; a last good check over an hour
        // old covers what the count can't see (restarts, a new month starting the count over).
        const stale = lastCheckedAt && now.getTime() - lastCheckedAt.getTime() > STALE_USAGE_MS;
        if ((failures >= getFileLimits().analyticsFailureLimit || stale) && await setTrip(now, 'reads', 'analytics_down')) {
            sendFileAlert(
                'links paused, the usage check is down',
                `The usage check couldn't get numbers from Cloudflare for about an hour (${failures} failures in a row this month). Links are paused until it works again; it clears itself.`,
            );
        }
        return { ok: false, code };
    }

    const { month: checked, storageBytes } = await recordRealUsage(now, real);
    const month = (await resumeIfAsked(now, real, storageBytes)) ?? checked;
    const trips = tripsFor(month, storageBytes);
    for (const direction of ['reads', 'writes']) {
        const reason = trips[direction];
        if (reason && await setTrip(now, direction, reason)) {
            sendFileAlert(`${direction === 'reads' ? 'links' : 'uploads'} paused: ${reason}`, usageText(month, storageBytes, [TRIP_NOTES[reason]]));
        }
    }
    await logFileUsage(now);
    return { ok: true, real, trips };
};

// Sweeps a minute after boot and then hourly; reconciles 90 s after boot and then every 10
// minutes. unref() so neither keeps a process alive.
export const startFileJob = () => {
    const sweep = () => sweepFiles().catch((error) => console.error('[files] sweep failed:', error.message));
    const reconcile = () => reconcileUsage().catch((error) => console.error('[files] usage check failed:', error.message));
    setTimeout(sweep, FIRST_SWEEP_MS).unref();
    setTimeout(reconcile, FIRST_RECONCILE_MS).unref();
    setInterval(reconcile, getFileLimits().reconcileIntervalMs).unref();
    return setInterval(sweep, SWEEP_INTERVAL_MS).unref();
};
