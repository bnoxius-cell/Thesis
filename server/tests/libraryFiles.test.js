import { describe, test, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../app.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { makeJpeg, makePng } from './helpers/fileFixtures.js';
import userModel from '../models/userModel.js';
import subjectModel from '../models/subjectModel.js';
import fileModel from '../models/fileModel.js';
import fileFolderModel from '../models/fileFolderModel.js';
import fileUsageModel from '../models/fileUsageModel.js';
import { monthId } from '../utils/fileBudget.js';
import { parseLocation, resolveLocation, LocationError } from '../utils/fileLocations.js';
import { getFileLimits, reloadFileLimits, setFileLimitsForTests } from '../utils/fileLimits.js';
import { setFileStoreForTests } from '../utils/fileStore.js';
import { createMemoryStore } from '../utils/fileStores/memoryStore.js';
import { resetRateLimits } from '../utils/rateLimit.js';
import { storeFile } from '../utils/storedFiles.js';
import { uploadSlotsInUse } from '../utils/uploads.js';
import { deleteUserData } from '../utils/userData.js';

vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
    sendOwnerAlertEmail: vi.fn().mockResolvedValue(undefined),
}));

const MIB = 1024 * 1024;
// What must never appear in a library response: object keys, row state, byte counters, the owner.
const LEAKS = /storageId|thumbStorageId|"state"|"owner"|"bytes"|r2:|memory:/;

let store;
let owner;
let other;
let subject;
let folder;
let foreignSubject;
let foreignFolder;

beforeAll(connectTestDB);
afterAll(async () => {
    reloadFileLimits();
    await closeTestDB();
});

beforeEach(async () => {
    await clearTestDB();
    resetRateLimits();
    ['warn', 'log', 'error'].forEach((level) => vi.spyOn(console, level).mockImplementation(() => {}));
    setFileLimitsForTests({});
    store = createMemoryStore();
    setFileStoreForTests(store);
    [owner, other] = await Promise.all(['a', 'b'].map((name) => userModel.create({ name, email: `${name}@student.fatima.edu.ph` })));
    [subject, foreignSubject] = await Promise.all([owner, other].map((user) => subjectModel.create({ owner: user._id, name: 'Math' })));
    [folder, foreignFolder] = await Promise.all([owner, other].map((user) => fileFolderModel.create({ owner: user._id, name: 'Thesis' })));
});
afterEach(() => {
    vi.restoreAllMocks();
});

const as = (user, req) => req.set('Cookie', `token=${jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET)}`);
const get = (user, path) => as(user, request(app).get(path));
const patch = (user, path, body) => as(user, request(app).patch(path)).send(body);
const del = (user, path) => as(user, request(app).delete(path));
const askLinks = (user, ids, variant = 'file') => as(user, request(app).post('/api/files/links')).send({ ids: ids.map(String), variant });
const usedBytes = async (user) => (await userModel.findById(user._id).lean()).storageUsedBytes ?? 0;
const classB = async () => (await fileUsageModel.findById(monthId(new Date())).lean())?.classB ?? 0;
const pdfBytes = (size = 64) => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(size, 0x20)]);

const upload = (user, to, parts = [['file', pdfBytes(), 'notes.pdf']]) => {
    const req = as(user, request(app).post(to === undefined ? '/api/files' : `/api/files?to=${to}`));
    for (const [field, buffer, filename] of parts) req.attach(field, buffer, filename);
    return req;
};

// A ready library file made the way the upload route makes it.
const addFile = (user, { refs = {}, photo = false, now } = {}) => storeFile({
    ownerId: user._id,
    scope: 'library',
    refs,
    file: photo
        ? { buffer: makePng(), name: 'photo.png', ext: 'png', mimeType: 'image/png', width: 4, height: 3 }
        : { buffer: pdfBytes(), name: 'notes.pdf', ext: 'pdf', mimeType: 'application/pdf' },
    thumb: photo ? { buffer: makeJpeg(), mimeType: 'image/jpeg' } : null,
    now,
});

// Rows written straight to the database, for counts and ordering.
const seedRows = (user, count, extra = {}) => fileModel.insertMany(Array.from({ length: count }, (_, index) => ({
    owner: user._id,
    scope: 'library',
    name: `file-${index}.pdf`,
    ext: 'pdf',
    mimeType: 'application/pdf',
    size: 10,
    bytes: 10,
    storageId: `memory:f/seed-${user._id}-${index}`,
    state: 'ready',
    ...extra,
})));

const until = async (check) => {
    for (let waited = 0; waited < 3000 && !check(); waited += 20) await new Promise((resolve) => { setTimeout(resolve, 20); });
    expect(check()).toBe(true);
};

describe('locations', () => {
    test('parseLocation accepts the three forms and rejects everything else', () => {
        const id = String(subject._id);
        expect(parseLocation('general')).toEqual({ type: 'general' });
        expect(parseLocation(`subject:${id}`)).toEqual({ type: 'subject', id });
        expect(parseLocation(`folder:${id}`)).toEqual({ type: 'folder', id });
        [undefined, null, '', 'General', 'subject', 'subject:', 'subject:nope', `chat:${id}`, `subject:${id}:x`, 'general:x', ['general'], { $ne: 'x' }, 7]
            .forEach((value) => expect(parseLocation(value)).toBeNull());
    });

    test('resolveLocation answers refs for owned places and a LocationError otherwise', async () => {
        expect(await resolveLocation(owner._id, 'general')).toEqual({ subject: null, folder: null });
        expect(await resolveLocation(owner._id, `subject:${subject._id}`)).toEqual({ subject: String(subject._id), folder: null });
        expect(await resolveLocation(owner._id, `folder:${folder._id}`)).toEqual({ subject: null, folder: String(folder._id) });
        await expect(resolveLocation(owner._id, `subject:${foreignSubject._id}`)).rejects.toMatchObject({ status: 404 });
        await expect(resolveLocation(owner._id, 'nope')).rejects.toBeInstanceOf(LocationError);
    });

    test('a file cannot be in a subject and a folder at once', async () => {
        await expect(fileModel.create({
            owner: owner._id, scope: 'library', name: 'a.pdf', ext: 'pdf', mimeType: 'application/pdf', size: 1, bytes: 1,
            storageId: 'memory:f/x', subject: subject._id, folder: folder._id,
        })).rejects.toThrow(/not both/);
    });
});

describe('POST /api/files', () => {
    test.each([
        ['General (no place given)', () => undefined, {}],
        ['General', () => 'general', {}],
        ['an owned subject', () => `subject:${subject._id}`, { subject: true }],
        ['an owned folder', () => `folder:${folder._id}`, { folder: true }],
    ])('stores a file in %s and answers the public shape only', async (_name, place, expected) => {
        const res = await upload(owner, place());
        expect(res.status).toBe(201);
        expect(Object.keys(res.body.file).sort()).toEqual(
            ['createdAt', 'ext', 'hasThumb', 'height', 'id', 'location', 'mimeType', 'name', 'size', 'width'],
        );
        expect(JSON.stringify(res.body)).not.toMatch(LEAKS);

        const row = await fileModel.findById(res.body.file.id).lean();
        expect(row).toMatchObject({ owner: owner._id, scope: 'library', state: 'ready' });
        expect(String(row.subject ?? '')).toBe(expected.subject ? String(subject._id) : '');
        expect(String(row.folder ?? '')).toBe(expected.folder ? String(folder._id) : '');
        const type = expected.subject ? 'subject' : expected.folder ? 'folder' : 'general';
        expect(res.body.file.location.type).toBe(type);
        expect(store.size()).toBe(1);
        await until(() => uploadSlotsInUse() === 0);
    });

    test('a photo without a preview is accepted and has no thumbnail', async () => {
        const res = await upload(owner, 'general', [['file', makePng(), 'photo.png']]);
        expect(res.status).toBe(201);
        expect(res.body.file).toMatchObject({ ext: 'png', hasThumb: false });
    });

    test('a photo with a preview says so', async () => {
        const res = await upload(owner, 'general', [['file', makePng(), 'photo.png'], ['thumb', makeJpeg(), 'thumb.jpg']]);
        expect(res.status).toBe(201);
        expect(res.body.file.hasThumb).toBe(true);
    });

    test.each([
        ['another student\'s subject', () => `subject:${foreignSubject._id}`, 404],
        ['another student\'s folder', () => `folder:${foreignFolder._id}`, 404],
        ['a subject id that is not an id', () => 'subject:nope', 400],
        ['an unknown kind', () => 'chat:abc', 400],
        ['an empty place', () => '', 400],
    ])('refuses %s before reading the body or spending anything', async (_name, place, status) => {
        const res = await upload(owner, place());
        expect(res.status).toBe(status);
        expect(res.body.success).toBe(false);
        expect(uploadSlotsInUse()).toBe(0);
        expect(await usedBytes(owner)).toBe(0);
        expect(await fileModel.countDocuments()).toBe(0);
        expect(store.size()).toBe(0);
    });

    test('a place sent twice (an array) is refused, and bracket keys never reach the place', async () => {
        const twice = await as(owner, request(app).post('/api/files?to=general&to=general')).attach('file', pdfBytes(), 'notes.pdf');
        expect(twice.status).toBe(400);
        expect(await usedBytes(owner)).toBe(0);
        // Express's simple query parser keeps `to[$ne]` as a key of its own, so it is just General.
        const bracket = await as(owner, request(app).post('/api/files?to[$ne]=x')).attach('file', pdfBytes(), 'notes.pdf');
        expect(bracket.status).toBe(201);
        expect(bracket.body.file.location).toEqual({ type: 'general' });
    });

    test('the 301st file is refused before the body is read', async () => {
        await seedRows(owner, 300);
        const res = await upload(owner);
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ success: false, code: 'too_many_files', message: 'You have 300 files. Delete some to add more.' });
        expect(await fileModel.countDocuments({ owner: owner._id })).toBe(300);
        expect(await usedBytes(owner)).toBe(0);
    });

    test('files being removed and other students\' files do not count toward the cap', async () => {
        await seedRows(owner, 298);
        await seedRows(owner, 5, { state: 'removing' });
        await seedRows(other, 50);
        expect((await upload(owner)).status).toBe(201);
        expect((await upload(owner)).status).toBe(201);
        expect((await upload(owner)).status).toBe(409);
    });

    test('a student who is not signed in gets no upload', async () => {
        const res = await request(app).post('/api/files').attach('file', pdfBytes(), 'notes.pdf');
        expect(res.body.success).toBe(false);
        expect(await fileModel.countDocuments()).toBe(0);
    });
});

describe('GET /api/files', () => {
    test('lists only this student\'s ready library files, newest first, without storage detail', async () => {
        const [oldest, middle, newest] = await Promise.all([1, 2, 3].map((day) => addFile(owner, { now: new Date() }).then(async (row) => {
            await fileModel.collection.updateOne({ _id: row._id }, { $set: { createdAt: new Date(2026, 10, day) } });
            return row;
        })));
        await addFile(other);
        await seedRows(owner, 1, { state: 'uploading' });
        await seedRows(owner, 1, { state: 'removing' });
        await seedRows(owner, 1, { scope: 'chat' });

        const res = await get(owner, '/api/files');
        expect(res.status).toBe(200);
        expect(res.body.files.map((file) => file.id)).toEqual([newest, middle, oldest].map((row) => String(row._id)));
        expect(JSON.stringify(res.body)).not.toMatch(LEAKS);
    });

    test('in= narrows to General, a subject or a folder', async () => {
        const inGeneral = await addFile(owner);
        const inSubject = await addFile(owner, { refs: { subject: subject._id } });
        const inFolder = await addFile(owner, { refs: { folder: folder._id } });
        const idsFor = async (place) => (await get(owner, `/api/files?in=${place}`)).body.files.map((file) => file.id);

        expect(await idsFor('general')).toEqual([String(inGeneral._id)]);
        expect(await idsFor(`subject:${subject._id}`)).toEqual([String(inSubject._id)]);
        expect(await idsFor(`folder:${folder._id}`)).toEqual([String(inFolder._id)]);
        expect((await get(owner, '/api/files')).body.files).toHaveLength(3);
    });

    test('a foreign, unknown or malformed place is refused', async () => {
        expect((await get(owner, `/api/files?in=subject:${foreignSubject._id}`)).status).toBe(404);
        expect((await get(owner, `/api/files?in=folder:${foreignFolder._id}`)).status).toBe(404);
        expect((await get(owner, '/api/files?in=nope')).status).toBe(400);
        expect((await get(owner, '/api/files?in=general&in=general')).status).toBe(400);
    });

    test('places come with active subjects in order and folders by name', async () => {
        await subjectModel.deleteMany({});
        await subjectModel.create([
            { owner: owner._id, name: 'Second', color: 'teal', order: 2 },
            { owner: owner._id, name: 'First', color: 'olive', order: 1 },
            { owner: owner._id, name: 'Old term', order: 0, archivedAt: new Date() },
        ]);
        await fileFolderModel.deleteMany({});
        await fileFolderModel.create([{ owner: owner._id, name: 'beta' }, { owner: owner._id, name: 'Alpha' }]);
        await fileFolderModel.create({ owner: other._id, name: 'Not mine' });

        const { locations } = (await get(owner, '/api/files')).body;
        expect(locations.subjects.map(({ name, color }) => [name, color])).toEqual([['First', 'olive'], ['Second', 'teal']]);
        expect(locations.folders.map(({ name }) => name)).toEqual(['Alpha', 'beta']);
        expect(Object.keys(locations.subjects[0]).sort()).toEqual(['color', 'id', 'name']);
    });

    test('usage matches the student\'s counter and the limit', async () => {
        await addFile(owner);
        const { usage } = (await get(owner, '/api/files')).body;
        expect(usage).toEqual({ usedBytes: await usedBytes(owner), limitBytes: 100 * MIB });
        expect(usage.usedBytes).toBeGreaterThan(0);
    });

    test('uploads are on without a month record and paused at the Class A cap', async () => {
        expect((await get(owner, '/api/files')).body.uploads).toEqual({ on: true });

        await fileUsageModel.updateOne({ _id: monthId(new Date()) }, { $set: { classA: getFileLimits().classAMonthlyCap } }, { upsert: true });
        const { uploads } = (await get(owner, '/api/files')).body;
        expect(uploads).toMatchObject({ on: false, code: 'files_paused' });
        expect(uploads.message).toMatch(/^File uploads are paused until [A-Z][a-z]+ 1 so StressCare stays free\./);
        expect(uploads.resumesAt).toBeTruthy();
    });

    test('uploads are off when files are off, and reading the state reserves nothing', async () => {
        setFileLimitsForTests({ availability: Object.freeze({ on: false, store: null, reason: 'disabled' }) });
        expect((await get(owner, '/api/files')).body.uploads).toMatchObject({ on: false, code: 'files_off' });
        expect(await fileUsageModel.countDocuments()).toBe(0);
    });
});

describe('POST /api/files/links', () => {
    test('gives a link for each of the student\'s own files, never cached', async () => {
        const rows = await Promise.all([addFile(owner), addFile(owner, { refs: { subject: subject._id } }), addFile(owner, { refs: { folder: folder._id } })]);
        const res = await askLinks(owner, rows.map((row) => row._id));
        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body.links).toHaveLength(3);
        res.body.links.forEach((link) => expect(link.url).toBeTruthy());
        expect(await classB()).toBe(3);
    });

    test('a thumbnail link works for a photo and is refused for a PDF', async () => {
        const photo = await addFile(owner, { photo: true });
        const pdf = await addFile(owner);
        expect((await askLinks(owner, [photo._id], 'thumb')).status).toBe(200);
        expect((await askLinks(owner, [pdf._id], 'thumb')).status).toBe(404);
    });

    test('one foreign file makes the whole request a 404 and spends nothing', async () => {
        const mine = await addFile(owner);
        const theirs = await addFile(other);
        const res = await askLinks(owner, [mine._id, theirs._id]);
        expect(res.status).toBe(404);
        expect(await classB()).toBe(0);
    });

    test('a chat file is not a library file', async () => {
        const mine = await addFile(owner);
        const [chat] = await seedRows(owner, 1, { scope: 'chat' });
        expect((await askLinks(owner, [mine._id, chat._id])).status).toBe(404);
        expect(await classB()).toBe(0);
    });

    test('more than 24 ids is refused before any query', async () => {
        const find = vi.spyOn(fileModel, 'find');
        const row = await addFile(owner);
        const res = await askLinks(owner, Array(25).fill(row._id));
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('too_many');
        expect(find).not.toHaveBeenCalled();
    });

    test('ids that are missing, not a list, empty or not ids are a 404', async () => {
        const send = (body) => as(owner, request(app).post('/api/files/links')).send(body);
        expect((await send({})).status).toBe(404);
        expect((await send({ ids: String(subject._id) })).status).toBe(404);
        expect((await send({ ids: { $ne: null } })).status).toBe(404);
        expect((await send({ ids: [] })).status).toBe(404);
        expect((await send({ ids: ['nope'] })).status).toBe(404);
        expect((await send({ ids: [{ $ne: null }] })).status).toBe(404);
    });

    test('a file being removed gives no link', async () => {
        const row = await addFile(owner);
        await fileModel.updateOne({ _id: row._id }, { $set: { state: 'removing' } });
        expect((await askLinks(owner, [row._id])).status).toBe(404);
        expect(await classB()).toBe(0);
    });
});

describe('PATCH /api/files/:fileId', () => {
    test('moves a file to a folder, a subject and back to General without touching the store', async () => {
        const row = await addFile(owner);
        const put = vi.spyOn(store, 'put');
        const remove = vi.spyOn(store, 'remove');
        const sizeBefore = store.size();

        const toFolder = await patch(owner, `/api/files/${row._id}`, { to: `folder:${folder._id}` });
        expect(toFolder.status).toBe(200);
        expect(toFolder.body.file.location).toEqual({ type: 'folder', id: String(folder._id) });

        const toSubject = await patch(owner, `/api/files/${row._id}`, { to: `subject:${subject._id}` });
        expect(toSubject.body.file.location).toEqual({ type: 'subject', id: String(subject._id) });
        const stored = await fileModel.findById(row._id).lean();
        expect(stored.folder).toBeNull();

        const toGeneral = await patch(owner, `/api/files/${row._id}`, { to: 'general' });
        expect(toGeneral.body.file.location).toEqual({ type: 'general' });
        expect(JSON.stringify(toGeneral.body)).not.toMatch(LEAKS);

        expect(put).not.toHaveBeenCalled();
        expect(remove).not.toHaveBeenCalled();
        expect(store.size()).toBe(sizeBefore);
    });

    test('a foreign subject or folder is a 404 and the file stays where it was', async () => {
        const row = await addFile(owner, { refs: { subject: subject._id } });
        expect((await patch(owner, `/api/files/${row._id}`, { to: `subject:${foreignSubject._id}` })).status).toBe(404);
        expect((await patch(owner, `/api/files/${row._id}`, { to: `folder:${foreignFolder._id}` })).status).toBe(404);
        const stored = await fileModel.findById(row._id).lean();
        expect(String(stored.subject)).toBe(String(subject._id));
        expect(stored.folder).toBeNull();
    });

    test('an archived subject is not a place to upload to, move to or list', async () => {
        const row = await addFile(owner);
        await subjectModel.updateOne({ _id: subject._id }, { $set: { archivedAt: new Date() } });
        expect((await patch(owner, `/api/files/${row._id}`, { to: `subject:${subject._id}` })).status).toBe(404);
        expect((await upload(owner, `subject:${subject._id}`)).status).toBe(404);
        expect((await get(owner, `/api/files?in=subject:${subject._id}`)).status).toBe(404);
        expect((await fileModel.findById(row._id).lean()).subject).toBeNull();
    });

    test('a bad place is a 400', async () => {
        const row = await addFile(owner);
        expect((await patch(owner, `/api/files/${row._id}`, {})).status).toBe(400);
        expect((await patch(owner, `/api/files/${row._id}`, { to: ['general'] })).status).toBe(400);
        expect((await patch(owner, `/api/files/${row._id}`, { to: { $ne: 'x' } })).status).toBe(400);
        expect((await patch(owner, `/api/files/${row._id}`, { to: 'subject:nope' })).status).toBe(400);
    });

    test('another student\'s file is a 404 and is not moved', async () => {
        const theirs = await addFile(other);
        const res = await patch(owner, `/api/files/${theirs._id}`, { to: `folder:${folder._id}` });
        expect(res.status).toBe(404);
        expect((await fileModel.findById(theirs._id).lean()).folder).toBeNull();
    });

    test('a file being removed, a chat file and a bad id are a 404', async () => {
        const removing = await addFile(owner);
        await fileModel.updateOne({ _id: removing._id }, { $set: { state: 'removing' } });
        const [chat] = await seedRows(owner, 1, { scope: 'chat' });
        for (const id of [removing._id, chat._id, 'nope']) {
            expect((await patch(owner, `/api/files/${id}`, { to: 'general' })).status).toBe(404);
        }
    });

    test('only the place changes: other fields in the body are ignored', async () => {
        const row = await addFile(owner);
        await patch(owner, `/api/files/${row._id}`, { to: 'general', name: 'renamed.pdf', owner: String(other._id), state: 'removing' });
        expect(await fileModel.findById(row._id).lean()).toMatchObject({ name: 'notes.pdf', owner: owner._id, state: 'ready' });
    });
});

describe('DELETE /api/files/:fileId', () => {
    test('deletes the file, its object and gives the space back', async () => {
        const row = await addFile(owner);
        expect(await usedBytes(owner)).toBeGreaterThan(0);

        const res = await del(owner, `/api/files/${row._id}`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        expect(await fileModel.exists({ _id: row._id })).toBeNull();
        expect(store.size()).toBe(0);
        expect(await usedBytes(owner)).toBe(0);
        expect((await get(owner, '/api/files')).body.files).toEqual([]);
    });

    test('another student\'s file is a 404 and stays', async () => {
        const theirs = await addFile(other);
        expect((await del(owner, `/api/files/${theirs._id}`)).status).toBe(404);
        expect((await fileModel.findById(theirs._id).lean()).state).toBe('ready');
        expect(store.size()).toBe(1);
        expect(await usedBytes(other)).toBeGreaterThan(0);
    });

    test('a chat file, a file already being removed and a bad id are a 404', async () => {
        const removing = await addFile(owner);
        await fileModel.updateOne({ _id: removing._id }, { $set: { state: 'removing' } });
        const [chat] = await seedRows(owner, 1, { scope: 'chat' });
        for (const id of [removing._id, chat._id, 'nope']) {
            expect((await del(owner, `/api/files/${id}`)).status).toBe(404);
        }
        expect(await fileModel.exists({ _id: chat._id })).toBeTruthy();
    });
});

describe('races and account deletion', () => {
    test('an upload that finishes after its subject was deleted ends up in General', async () => {
        let release;
        const gate = new Promise((resolve) => { release = resolve; });
        let reached = false;
        const put = store.put;
        store.put = async (...args) => {
            reached = true;
            await gate;
            return put(...args);
        };

        const pending = upload(owner, `subject:${subject._id}`).then((res) => res);
        await until(() => reached);
        await subjectModel.deleteOne({ _id: subject._id });
        release();
        const res = await pending;

        expect(res.status).toBe(201);
        expect(res.body.file.location).toEqual({ type: 'general' });
        const listed = (await get(owner, '/api/files?in=general')).body.files;
        expect(listed.map((file) => file.id)).toEqual([res.body.file.id]);
        expect((await fileModel.findById(res.body.file.id).lean()).subject).toBeNull();
    });

    test('a move that finishes after its folder was deleted ends up in General', async () => {
        const row = await addFile(owner);
        const original = fileModel.findOneAndUpdate.bind(fileModel);
        vi.spyOn(fileModel, 'findOneAndUpdate').mockImplementationOnce(async (...args) => {
            const moved = await original(...args);
            await fileFolderModel.deleteOne({ _id: folder._id });
            return moved;
        });
        const res = await patch(owner, `/api/files/${row._id}`, { to: `folder:${folder._id}` });
        expect(res.status).toBe(200);
        expect(res.body.file.location).toEqual({ type: 'general' });
    });

    test('deleting the account removes every library object and every folder', async () => {
        await addFile(owner);
        await addFile(owner, { refs: { subject: subject._id }, photo: true });
        await addFile(owner, { refs: { folder: folder._id } });
        await addFile(other);
        expect(store.size()).toBe(5);

        await deleteUserData(owner._id);
        expect(store.size()).toBe(1);
        expect(await fileModel.countDocuments({ owner: owner._id })).toBe(0);
        expect(await fileFolderModel.countDocuments({ owner: owner._id })).toBe(0);
        expect(await fileFolderModel.countDocuments({ owner: other._id })).toBe(1);
    });
});
