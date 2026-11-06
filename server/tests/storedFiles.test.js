import { describe, test, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { makePng } from './helpers/fileFixtures.js';
import userModel from '../models/userModel.js';
import fileModel from '../models/fileModel.js';
import fileUsageModel from '../models/fileUsageModel.js';
import fileUserDayModel from '../models/fileUserDayModel.js';
import { reloadFileLimits, setFileLimitsForTests } from '../utils/fileLimits.js';
import { setFileStoreForTests } from '../utils/fileStore.js';
import { createMemoryStore, DEV_LINK_PREFIX } from '../utils/fileStores/memoryStore.js';
import { monthId } from '../utils/fileBudget.js';
import { issueFileLinks, objectHeaders, removeFiles, storeFile, sweepFiles } from '../utils/storedFiles.js';
import { deleteUserData } from '../utils/userData.js';

vi.mock('../utils/emailService.js', () => ({ sendOwnerAlertEmail: vi.fn().mockResolvedValue(undefined) }));

const MIB = 1024 * 1024;
const NOW = new Date('2026-11-15T10:00:00Z');

let store;
let logs;
// Limits with some values replaced, and a fresh memory store (the limits change drops the old one).
const useLimits = (overrides = {}) => {
    setFileLimitsForTests(overrides);
    store = createMemoryStore();
    setFileStoreForTests(store);
};

beforeAll(connectTestDB);
beforeEach(async () => {
    await clearTestDB();
    logs = ['warn', 'log', 'error'].map((level) => vi.spyOn(console, level).mockImplementation(() => {}));
    useLimits();
});
afterEach(() => logs.forEach((spy) => spy.mockRestore()));
afterAll(async () => {
    reloadFileLimits();
    await closeTestDB();
});

let userCount = 0;
const makeUser = () => {
    userCount += 1;
    return userModel.create({ name: `Student ${userCount}`, email: `student${userCount}@student.fatima.edu.ph` });
};

const pdf = (bytes = 10) => ({ buffer: Buffer.alloc(bytes, 1), name: 'notes.pdf', ext: 'pdf', mimeType: 'application/pdf' });
const photo = () => ({ buffer: makePng(4, 3), name: 'photo.png', ext: 'png', mimeType: 'image/png', width: 4, height: 3 });
const thumb = () => ({ buffer: Buffer.alloc(50, 2), mimeType: 'image/jpeg' });

const store1 = (owner, { file = pdf(), withThumb = false, now = NOW, refs = {} } = {}) => storeFile({
    ownerId: owner._id, scope: 'subject', refs, file, thumb: withThumb ? thumb() : null, now,
});

const settle = (promises) => Promise.allSettled(promises).then((results) => ({
    ok: results.filter((result) => result.status === 'fulfilled').map((result) => result.value),
    failed: results.filter((result) => result.status === 'rejected').map((result) => result.reason),
}));

const used = async (user) => (await userModel.findById(user._id).lean()).storageUsedBytes;
const serverBytes = async () => (await fileUsageModel.findById('storage').lean())?.bytes ?? 0;
const month = async (now = NOW) => (await fileUsageModel.findById(monthId(now)).lean()) ?? {};
const tokenOf = (url) => url.slice(DEV_LINK_PREFIX.length);

describe('storeFile', () => {
    test('writes a ready row, the object with its headers, and counts the bytes', async () => {
        const user = await makeUser();
        const row = await store1(user, { file: photo(), withThumb: true });
        expect(row.state).toBe('ready');
        expect(row.bytes).toBe(photo().buffer.length + 50);
        expect(row.storageId).toMatch(/^memory:f\//);
        expect(row.thumbStorageId).toMatch(/^memory:t\//);
        expect(row.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(store.size()).toBe(2);
        expect(await used(user)).toBe(row.bytes);
        expect(await serverBytes()).toBe(row.bytes);
        expect(await month()).toMatchObject({ classA: 2, uploadBytes: row.bytes });
    });

    test('race, per student: 10 concurrent 6 MiB uploads against 50 MiB, exactly 8 land', async () => {
        useLimits({ userStorageBytes: 50 * MIB });
        const user = await makeUser();
        const { ok, failed } = await settle(Array.from({ length: 10 }, () => store1(user, { file: pdf(6 * MIB) })));
        expect(ok).toHaveLength(8);
        expect(failed.map((error) => error.code)).toEqual(['quota_full', 'quota_full']);
        expect(await used(user)).toBe(48 * MIB);
        expect(store.size()).toBe(8);
    });

    test('race, server-wide: 3 students x 3 concurrent 3 MiB against 20 MiB, exactly 6 land', async () => {
        useLimits({ storageCapBytes: 20 * MIB });
        const users = await Promise.all([makeUser(), makeUser(), makeUser()]);
        const attempts = users.flatMap((user) => [1, 2, 3].map(() => store1(user, { file: pdf(3 * MIB) }).then(() => user)));
        const { ok, failed } = await settle(attempts);
        expect(ok).toHaveLength(6);
        expect(new Set(failed.map((error) => error.code))).toEqual(new Set(['storage_full']));
        expect(await serverBytes()).toBe(18 * MIB);
        for (const user of users) {
            const successes = ok.filter((winner) => winner._id.equals(user._id)).length;
            expect(await used(user)).toBe(successes * 3 * MIB);
        }
    });

    test('race, Class A: cap 5, 8 concurrent photo uploads (2 each), exactly 2 land', async () => {
        useLimits({ classAMonthlyCap: 5 });
        const user = await makeUser();
        const { ok, failed } = await settle(Array.from({ length: 8 }, () => store1(user, { file: photo(), withThumb: true })));
        expect(ok).toHaveLength(2);
        expect((await month()).classA).toBe(4);
        failed.forEach((error) => {
            expect(error.code).toBe('files_paused');
            expect(error.resumesAt.toISOString()).toBe('2026-12-01T00:00:00.000Z');
            expect(error.message).toContain('File uploads are paused until December 1');
        });
        expect(await used(user)).toBe(ok[0].bytes * 2);
        expect(store.size()).toBe(4);
    });

    test('upload traffic: with a 10 MiB month, the third 4 MiB upload is refused', async () => {
        useLimits({ uploadMonthlyBytes: 10 * MIB });
        const user = await makeUser();
        await store1(user, { file: pdf(4 * MIB) });
        await store1(user, { file: pdf(4 * MIB) });
        await expect(store1(user, { file: pdf(4 * MIB) })).rejects.toMatchObject({ code: 'files_paused' });
        expect(await used(user)).toBe(8 * MIB);
        expect(await serverBytes()).toBe(8 * MIB);
    });

    test('tripped writes block uploads; tripped reads do not', async () => {
        const user = await makeUser();
        await store1(user);
        await fileUsageModel.updateOne({ _id: monthId(NOW) }, { $set: { 'tripped.reads': 'uncounted_reads' } });
        await store1(user);
        await fileUsageModel.updateOne({ _id: monthId(NOW) }, { $set: { 'tripped.writes': 'storage_gap' } });
        await expect(store1(user)).rejects.toMatchObject({ code: 'files_paused' });
    });

    test('month rollover: blocked at the cap in November, fine in December', async () => {
        useLimits({ classAMonthlyCap: 1 });
        const user = await makeUser();
        await store1(user);
        await expect(store1(user)).rejects.toMatchObject({ code: 'files_paused' });
        const december = new Date('2026-12-01T00:00:00Z');
        await store1(user, { now: december });
        expect(await month(december)).toMatchObject({ classA: 1, tripped: { reads: '', writes: '' } });
    });

    test('daily: the 61st upload of the day is refused, the next UTC day is fine', async () => {
        const user = await makeUser();
        await Promise.all(Array.from({ length: 60 }, () => store1(user, { file: pdf(1) })));
        await expect(store1(user, { file: pdf(1) })).rejects.toMatchObject({ status: 429, code: 'daily_limit' });
        await store1(user, { file: pdf(1), now: new Date('2026-11-16T00:00:00Z') });
    });

    test('a failed put leaves no row and no object, gives storage back, and keeps the Class A spent', async () => {
        const user = await makeUser();
        store.failNext('put');
        await expect(store1(user)).rejects.toMatchObject({ status: 502, code: 'store_failed' });
        expect(await fileModel.countDocuments()).toBe(0);
        expect(store.size()).toBe(0);
        expect(await used(user)).toBe(0);
        expect(await serverBytes()).toBe(0);
        expect((await month()).classA).toBe(1);
    });

    test('a failed thumbnail put removes the file already stored', async () => {
        const user = await makeUser();
        const original = store.put;
        let puts = 0;
        store.put = async (...args) => {
            puts += 1;
            if (puts === 2) store.failNext('put');
            return original(...args);
        };
        await expect(store1(user, { file: photo(), withThumb: true })).rejects.toMatchObject({ code: 'store_failed' });
        expect(store.size()).toBe(0);
        expect(await fileModel.countDocuments()).toBe(0);
        expect(await used(user)).toBe(0);
    });
});

describe('objectHeaders', () => {
    test('images inline and cached; documents attachment and never cached', () => {
        expect(objectHeaders({ name: 'photo.png', mimeType: 'image/png' })).toEqual({
            'Content-Type': 'image/png',
            'Content-Disposition': expect.stringMatching(/^inline; /),
            'Cache-Control': 'private, max-age=86400, immutable',
        });
        expect(objectHeaders({ name: 'notes.pdf', mimeType: 'application/pdf' })).toEqual({
            'Content-Type': 'application/pdf',
            'Content-Disposition': expect.stringMatching(/^attachment; /),
            'Cache-Control': 'private, no-store',
        });
        expect(objectHeaders({ name: 'x.svg', mimeType: 'image/svg+xml' })['Content-Disposition']).toMatch(/^attachment; /);
    });

    test('a thumbnail uses its own type', () => {
        const row = { name: 'photo.png', mimeType: 'image/png', thumbMimeType: 'image/jpeg' };
        expect(objectHeaders(row, 'thumb')['Content-Type']).toBe('image/jpeg');
    });

    test('the store received exactly those headers', async () => {
        const user = await makeUser();
        const image = await store1(user, { file: photo() });
        const doc = await store1(user, { file: pdf() });
        for (const row of [image, doc]) {
            const [link] = await issueFileLinks([row], { userId: user._id, now: NOW });
            const { object } = store.openDevLink(tokenOf(link.url), NOW.getTime());
            const expected = Object.fromEntries(Object.entries(objectHeaders(row)).map(([name, value]) => [name.toLowerCase(), value]));
            expect(object.headers).toEqual(expected);
        }
    });
});

describe('issueFileLinks', () => {
    const readyRows = async (user, count, options) => {
        const rows = [];
        for (let index = 0; index < count; index += 1) rows.push(await store1(user, options));
        return rows;
    };

    test('returns one link per row that expires after the TTL', async () => {
        const user = await makeUser();
        const rows = await readyRows(user, 3);
        const links = await issueFileLinks(rows, { userId: user._id, now: NOW });
        expect(links.map((link) => link.id)).toEqual(rows.map((row) => String(row._id)));
        links.forEach((link) => {
            expect(link.url.startsWith(DEV_LINK_PREFIX)).toBe(true);
            expect(link.expiresAt.getTime()).toBe(NOW.getTime() + 60 * 1000);
        });
        expect((await month()).classB).toBe(3);
    });

    test('thumbnail links need a thumbnail', async () => {
        const user = await makeUser();
        const [withThumb] = await readyRows(user, 1, { file: photo(), withThumb: true });
        const [withoutThumb] = await readyRows(user, 1);
        const [link] = await issueFileLinks([withThumb], { variant: 'thumb', userId: user._id, now: NOW });
        expect(store.openDevLink(tokenOf(link.url), NOW.getTime()).object.headers['content-type']).toBe('image/jpeg');
        await expect(issueFileLinks([withoutThumb], { variant: 'thumb', userId: user._id, now: NOW }))
            .rejects.toMatchObject({ status: 404 });
        await expect(issueFileLinks([withThumb], { variant: 'other', userId: user._id, now: NOW }))
            .rejects.toMatchObject({ status: 404 });
    });

    test('a 25-row batch is refused before anything is reserved', async () => {
        const user = await makeUser();
        const [row] = await readyRows(user, 1);
        await expect(issueFileLinks(Array(25).fill(row), { userId: user._id, now: NOW })).rejects.toMatchObject({ code: 'too_many' });
        expect((await month()).classB).toBe(0);
        expect((await fileUserDayModel.findOne({ user: user._id }).lean()).links).toBe(0);
    });

    test('a row still uploading or being removed is refused, and nothing is reserved', async () => {
        const user = await makeUser();
        const [row] = await readyRows(user, 1);
        for (const state of ['uploading', 'removing']) {
            await expect(issueFileLinks([row, { ...row.toObject(), state }], { userId: user._id, now: NOW }))
                .rejects.toMatchObject({ status: 404 });
        }
        expect((await month()).classB).toBe(0);
    });

    test('race, links: Class B cap 10, 6 concurrent batches of 3, exactly 3 succeed', async () => {
        useLimits({ classBMonthlyCap: 10 });
        const user = await makeUser();
        const rows = await readyRows(user, 3);
        const { ok, failed } = await settle(Array.from({ length: 6 }, () => issueFileLinks(rows, { userId: user._id, now: NOW })));
        expect(ok).toHaveLength(3);
        ok.forEach((links) => expect(links).toHaveLength(3));
        expect(failed.map((error) => error.code)).toEqual(['files_paused', 'files_paused', 'files_paused']);
        expect(failed[0].message).toContain("Files can't be opened until December 1");
        expect((await month()).classB).toBe(9);
    });

    test('tripped reads block links at once and spend nothing; uploads still work', async () => {
        const user = await makeUser();
        const [row] = await readyRows(user, 1);
        await fileUsageModel.updateOne({ _id: monthId(NOW) }, { $set: { 'tripped.reads': 'uncounted_reads' } });
        await expect(issueFileLinks([row], { userId: user._id, now: NOW })).rejects.toMatchObject({ code: 'files_paused' });
        expect((await month()).classB).toBe(0);
        await store1(user);
    });

    test('daily: 400 links pass, a batch that would make 401 issues none', async () => {
        const user = await makeUser();
        const rows = await readyRows(user, 24);
        for (let batch = 0; batch < 16; batch += 1) await issueFileLinks(rows, { userId: user._id, now: NOW });
        await expect(issueFileLinks(rows.slice(0, 17), { userId: user._id, now: NOW }))
            .rejects.toMatchObject({ status: 429, code: 'daily_limit' });
        expect((await month()).classB).toBe(384);
        await issueFileLinks(rows.slice(0, 16), { userId: user._id, now: NOW });
        expect((await month()).classB).toBe(400);
        await expect(issueFileLinks(rows.slice(0, 1), { userId: user._id, now: NOW })).rejects.toMatchObject({ code: 'daily_limit' });
    });

    test('replay is uncounted (by design): one link opened 3 times costs one Class B', async () => {
        const user = await makeUser();
        const [row] = await readyRows(user, 1);
        const [link] = await issueFileLinks([row], { userId: user._id, now: NOW });
        for (let open = 0; open < 3; open += 1) expect(store.openDevLink(tokenOf(link.url), NOW.getTime() + 1000).object).toBeTruthy();
        expect(store.devReads(row.storageId.slice('memory:'.length))).toBe(3);
        expect((await month()).classB).toBe(1);
        expect(store.openDevLink(tokenOf(link.url), NOW.getTime() + 61 * 1000)).toEqual({ reason: 'expired' });
    });
});

describe('removing files', () => {
    test('removeFiles deletes objects and rows, then gives storage back', async () => {
        const user = await makeUser();
        const message = new mongoose.Types.ObjectId();
        const row = await store1(user, { file: photo(), withThumb: true, refs: { message } });
        const other = await store1(user);
        expect(await removeFiles({ message })).toEqual({ removed: 1 });
        expect(await fileModel.exists({ _id: row._id })).toBeNull();
        expect(store.size()).toBe(1);
        expect(await used(user)).toBe(other.bytes);
        expect(await serverBytes()).toBe(other.bytes);
    });

    test('storage comes back only after the delete succeeds', async () => {
        const user = await makeUser();
        const row = await store1(user);
        store.failNext('remove');
        expect(await removeFiles({ _id: row._id })).toEqual({ removed: 0 });
        const left = await fileModel.findById(row._id).lean();
        expect(left).toMatchObject({ state: 'removing', removeAttempts: 1 });
        expect(await used(user)).toBe(row.bytes);

        await expect(issueFileLinks([left], { userId: user._id, now: NOW })).rejects.toMatchObject({ status: 404 });
        expect(await sweepFiles(NOW)).toEqual({ removed: 1, failed: 0 });
        expect(await used(user)).toBe(0);
        expect(await serverBytes()).toBe(0);
    });

    test('two removers racing release the storage once', async () => {
        const user = await makeUser();
        const keep = await store1(user);
        const row = await store1(user);
        await Promise.all([removeFiles({ _id: row._id }), removeFiles({ _id: row._id }), sweepFiles(NOW)]);
        expect(await used(user)).toBe(keep.bytes);
        expect(await serverBytes()).toBe(keep.bytes);
    });

    test('an empty, unexpected or non-id filter is refused', async () => {
        await expect(removeFiles({})).rejects.toThrow(TypeError);
        await expect(removeFiles({ state: 'ready' })).rejects.toThrow(TypeError);
        await expect(removeFiles({ owner: { $ne: null } })).rejects.toThrow(TypeError);
        await expect(removeFiles({ group: undefined })).rejects.toThrow(TypeError);
    });

    test('a row made by another store is left for that store', async () => {
        const user = await makeUser();
        const row = await fileModel.create({
            owner: user._id, scope: 'subject', name: 'a.pdf', ext: 'pdf', mimeType: 'application/pdf',
            size: 5, bytes: 5, storageId: 'r2:f/00000000-0000-4000-8000-000000000000', state: 'ready',
        });
        await removeFiles({ _id: row._id });
        expect((await fileModel.findById(row._id).lean()).state).toBe('removing');
    });
});

describe('sweeper', () => {
    test('gives up on an upload older than an hour and leaves a fresh one', async () => {
        const user = await makeUser();
        const fields = {
            owner: user._id, scope: 'subject', name: 'a.pdf', ext: 'pdf', mimeType: 'application/pdf', size: 100, bytes: 100,
        };
        const stale = await fileModel.create({ ...fields, storageId: 'memory:f/00000000-0000-4000-8000-000000000001' });
        const fresh = await fileModel.create({ ...fields, storageId: 'memory:f/00000000-0000-4000-8000-000000000002' });
        await fileModel.collection.updateOne({ _id: stale._id }, { $set: { updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
        await userModel.updateOne({ _id: user._id }, { $set: { storageUsedBytes: 200 } });

        expect(await sweepFiles(new Date())).toEqual({ removed: 1, failed: 0 });
        expect(await fileModel.exists({ _id: stale._id })).toBeNull();
        expect((await fileModel.findById(fresh._id).lean()).state).toBe('uploading');
        expect(await used(user)).toBe(100);
    });

    test('leaves the storage counters as they are, so it can never race a release', async () => {
        const [low, high] = await Promise.all([makeUser(), makeUser()]);
        await store1(low);
        await store1(high);
        await userModel.updateOne({ _id: low._id }, { $set: { storageUsedBytes: 0 } });
        await userModel.updateOne({ _id: high._id }, { $set: { storageUsedBytes: 5000 } });
        await fileUsageModel.updateOne({ _id: 'storage' }, { $set: { bytes: 7 } });

        await sweepFiles(NOW);
        expect(await used(low)).toBe(0);
        expect(await used(high)).toBe(5000);
        expect(await serverBytes()).toBe(7);
    });

    test('logs one usage line with counts and no link or key', async () => {
        const user = await makeUser();
        const row = await store1(user);
        await issueFileLinks([row], { userId: user._id, now: NOW });
        await sweepFiles(NOW);
        const lines = logs[1].mock.calls.map(([line]) => line).filter((line) => line.startsWith('[files] usage'));
        expect(lines).toEqual(['[files] usage storage=0/5000 classA=1/100000 (real 0) classB=1/1000000 (real 0) upload=0/1000 tripped=none']);
        const everything = logs.flatMap((spy) => spy.mock.calls.flat()).join('\n');
        expect(everything).not.toContain(DEV_LINK_PREFIX);
        expect(everything).not.toContain(row.storageId.slice('memory:'.length));
    });
});

describe('kill switch', () => {
    test('files off: no uploads, no links, deletes only mark rows, the sweeper idles', async () => {
        const user = await makeUser();
        const row = await store1(user);
        setFileStoreForTests(null);

        await expect(store1(user)).rejects.toMatchObject({ status: 503, code: 'files_off' });
        await expect(issueFileLinks([row], { userId: user._id, now: NOW })).rejects.toMatchObject({ code: 'files_off' });
        expect(await removeFiles({ _id: row._id })).toEqual({ removed: 0 });
        expect((await fileModel.findById(row._id).lean()).state).toBe('removing');
        expect(await used(user)).toBe(row.bytes);
        expect(await sweepFiles(NOW)).toBeNull();
        expect(store.size()).toBe(1);

        setFileStoreForTests(store);
        await sweepFiles(NOW);
        expect(store.size()).toBe(0);
        expect(await used(user)).toBe(0);
    });
});

describe('account deletion', () => {
    test('deleteUserData removes the student files, objects and daily rows, and leaves others', async () => {
        const [leaving, staying] = await Promise.all([makeUser(), makeUser()]);
        await store1(leaving, { file: photo(), withThumb: true });
        await store1(leaving);
        const kept = await store1(staying);

        await deleteUserData(leaving._id);
        expect(await fileModel.countDocuments({ owner: leaving._id })).toBe(0);
        expect(await fileUserDayModel.countDocuments({ user: leaving._id })).toBe(0);
        expect(store.keys()).toEqual([kept.storageId.slice('memory:'.length)]);
        expect(await serverBytes()).toBe(kept.bytes);
    });
});
