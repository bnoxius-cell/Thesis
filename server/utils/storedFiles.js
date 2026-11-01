// A stored file's life (plan 18, 3.5): reserve the budget, write the ledger row, put the objects,
// mark it ready; hand out short-lived links; and remove it again, giving storage back only after
// the objects are really gone. The ledger row exists before any object, so nothing is orphaned.
import { createHash, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import fileModel from '../models/fileModel.js';
import { filesAvailability, getFileLimits } from './fileLimits.js';
import { getFileStore } from './fileStore.js';
import { StoreError } from './fileStores/storeError.js';
import { contentDisposition } from './fileNames.js';
import {
    fileError, logFileUsage, raiseGlobalStorage, raiseUserStorage, releaseStorage, reserveLinks, reserveUpload,
} from './fileBudget.js';

const HOUR_MS = 60 * 60 * 1000;
const STALE_UPLOAD_MS = HOUR_MS; // a put times out after 15 s, so an hour-old upload is dead
const SWEEP_INTERVAL_MS = HOUR_MS;
const FIRST_SWEEP_MS = 60 * 1000;
const SWEEP_BATCH = 200;
const REMOVE_FILTER_KEYS = new Set(['_id', 'owner', 'group', 'message', 'subject']);

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
// thumb: { buffer, mimeType } or null. refs: { group, message } for chat, { subject } for subjects.
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

// Removes every file matching `filter` (by owner, group, message, subject or _id). Rows are marked
// removing first, so they stop handing out links at once even when the objects can't be deleted
// yet (files off, or the store failing); the sweeper finishes those later.
export const removeFiles = async (filter) => {
    // Plain ids only, so a value from a request (say { $ne: null }) can never widen the match.
    const entries = Object.entries(filter);
    if (!entries.length || entries.some(([key, value]) => !REMOVE_FILTER_KEYS.has(key) || !mongoose.isObjectIdOrHexString(value))) {
        throw new TypeError('removeFiles needs an id filter on owner, group, message, subject or _id');
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

// Lifts the storage counters to at least what the ledger holds. Raise only: a counter that is
// too high is safe and stays (the usage page shows the drift).
const raiseCountersToLedger = async () => {
    const perOwner = await fileModel.aggregate([{ $group: { _id: '$owner', bytes: { $sum: '$bytes' } } }]);
    for (const { _id, bytes } of perOwner) await raiseUserStorage(_id, bytes);
    await raiseGlobalStorage(perOwner.reduce((sum, { bytes }) => sum + bytes, 0));
};

// Hourly: gives up on dead uploads, retries deletes, raises drifted counters, logs usage.
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
    await raiseCountersToLedger();
    await logFileUsage(now);
    return { removed, failed: rows.length - removed };
};

// Runs once a minute after boot and then hourly. unref() so it never keeps a process alive.
export const startFileJob = () => {
    const run = () => sweepFiles().catch((error) => console.error('[files] sweep failed:', error.message));
    setTimeout(run, FIRST_SWEEP_MS).unref();
    return setInterval(run, SWEEP_INTERVAL_MS).unref();
};
