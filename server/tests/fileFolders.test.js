import { describe, test, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../app.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import userModel from '../models/userModel.js';
import subjectModel from '../models/subjectModel.js';
import fileModel from '../models/fileModel.js';
import fileFolderModel from '../models/fileFolderModel.js';
import { reloadFileLimits, setFileLimitsForTests } from '../utils/fileLimits.js';
import { setFileStoreForTests } from '../utils/fileStore.js';
import { createMemoryStore } from '../utils/fileStores/memoryStore.js';
import { resetRateLimits } from '../utils/rateLimit.js';
import { storeFile } from '../utils/storedFiles.js';

vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
    sendOwnerAlertEmail: vi.fn().mockResolvedValue(undefined),
}));

let store;
let owner;
let other;

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
});
afterEach(() => {
    vi.restoreAllMocks();
});

const as = (user, req) => req.set('Cookie', `token=${jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET)}`);
const get = (user, path) => as(user, request(app).get(path));
const post = (user, body) => as(user, request(app).post('/api/files/folders')).send(body);
const rename = (user, id, body) => as(user, request(app).patch(`/api/files/folders/${id}`)).send(body);
const del = (user, path) => as(user, request(app).delete(path));
const makeFolder = (user, name = 'Thesis') => fileFolderModel.create({ owner: user._id, name });
const usedBytes = async (user) => (await userModel.findById(user._id).lean()).storageUsedBytes ?? 0;

const addFile = (user, refs = {}) => storeFile({
    ownerId: user._id,
    scope: 'library',
    refs,
    file: { buffer: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(64, 0x20)]), name: 'notes.pdf', ext: 'pdf', mimeType: 'application/pdf' },
    thumb: null,
});

describe('create', () => {
    test('makes a folder, trims and collapses the name, and lists it', async () => {
        const res = await post(owner, { name: '  My   Thesis ' });
        expect(res.status).toBe(201);
        expect(res.body.folder).toEqual({ id: expect.any(String), name: 'My Thesis' });
        const listed = await get(owner, '/api/files');
        expect(listed.body.locations.folders).toEqual([res.body.folder]);
    });

    test('nameKey comes from the name, never from the body', async () => {
        const res = await post(owner, { name: 'Notes', nameKey: 'other', owner: String(other._id) });
        expect(res.status).toBe(201);
        const row = await fileFolderModel.findById(res.body.folder.id).lean();
        expect(row).toMatchObject({ nameKey: 'notes', owner: owner._id });
    });

    test('needs a signed-in student', async () => {
        expect((await request(app).post('/api/files/folders').send({ name: 'x' })).body.success).toBe(false);
    });

    test('refuses empty, non-text and overlong names', async () => {
        for (const body of [{}, { name: '   ' }, { name: 7 }, { name: ['a'] }, { name: { $ne: 'x' } }]) {
            const res = await post(owner, body);
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Give the folder a name.');
        }
        const long = await post(owner, { name: 'x'.repeat(41) });
        expect(long.status).toBe(400);
        expect(long.body.message).toBe('The name can be up to 40 characters.');
        expect((await post(owner, { name: 'x'.repeat(40) })).status).toBe(201);
    });

    test('the 21st folder is refused', async () => {
        for (let i = 0; i < 20; i += 1) expect((await post(owner, { name: `Folder ${i}` })).status).toBe(201);
        const res = await post(owner, { name: 'One more' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/up to 20 folders/);
        expect((await post(other, { name: 'One more' })).status).toBe(201);
    });

    test('General in any case or spacing is taken', async () => {
        for (const name of ['general', 'GENERAL ', ' General']) {
            const res = await post(owner, { name });
            expect(res.status).toBe(409);
            expect(res.body.message).toBe('That name is already used for General.');
        }
    });

    test("an active subject's name is taken, an archived or foreign one is not", async () => {
        await subjectModel.create({ owner: owner._id, name: 'Data Structures' });
        await subjectModel.create({ owner: owner._id, name: 'Old Course', archivedAt: new Date() });
        await subjectModel.create({ owner: other._id, name: 'Physics' });
        for (const name of ['data structures', ' DATA   STRUCTURES ', 'Data-Structures']) {
            const res = await post(owner, { name });
            expect(res.status).toBe(409);
            expect(res.body.message).toMatch(/already have a subject called/);
        }
        expect((await post(owner, { name: 'Old Course' })).status).toBe(201);
        expect((await post(owner, { name: 'Physics' })).status).toBe(201);
    });

    test('a duplicate name is a 409 whatever the case, per student', async () => {
        await post(owner, { name: 'Thesis' });
        const res = await post(owner, { name: ' tHESIS ' });
        expect(res.status).toBe(409);
        expect(res.body.message).toBe('You already have a folder called tHESIS.');
        expect((await post(other, { name: 'Thesis' })).status).toBe(201);
    });

    test('two creates of the same name at once leave one folder and a 409, not a 500', async () => {
        const results = await Promise.all([post(owner, { name: 'Race' }), post(owner, { name: 'Race' })]);
        expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
        expect(await fileFolderModel.countDocuments({ owner: owner._id })).toBe(1);
    });
});

describe('rename', () => {
    test('renames, and a change of case on its own name is fine', async () => {
        const folder = await makeFolder(owner);
        const res = await rename(owner, folder._id, { name: ' thesis  work ' });
        expect(res.body).toEqual({ success: true, folder: { id: String(folder._id), name: 'thesis work' } });
        expect(await fileFolderModel.findById(folder._id).lean()).toMatchObject({ name: 'thesis work', nameKey: 'thesis work' });
        expect((await rename(owner, folder._id, { name: 'Thesis Work' })).status).toBe(200);
    });

    test('applies the same name rules', async () => {
        const folder = await makeFolder(owner);
        await makeFolder(owner, 'Other');
        await subjectModel.create({ owner: owner._id, name: 'Math' });
        expect((await rename(owner, folder._id, { name: '' })).status).toBe(400);
        expect((await rename(owner, folder._id, { name: 'x'.repeat(41) })).status).toBe(400);
        expect((await rename(owner, folder._id, { name: 'general' })).status).toBe(409);
        expect((await rename(owner, folder._id, { name: 'math' })).status).toBe(409);
        expect((await rename(owner, folder._id, { name: 'OTHER' })).status).toBe(409);
        expect((await fileFolderModel.findById(folder._id).lean()).name).toBe('Thesis');
    });

    test('a name saved before the 40-character limit still lists, keeps, and renames', async () => {
        const long = 'A folder named before the limit came down to forty';
        const { insertedId } = await fileFolderModel.collection.insertOne({ owner: owner._id, name: long, nameKey: long.toLowerCase() });
        const listed = await get(owner, '/api/files');
        expect(listed.status).toBe(200);
        expect(listed.body.locations.folders).toEqual([{ id: String(insertedId), name: long }]);

        const kept = await rename(owner, insertedId, { name: long });
        expect(kept.body).toEqual({ success: true, folder: { id: String(insertedId), name: long } });

        const renamed = await rename(owner, insertedId, { name: 'Short name' });
        expect(renamed.body).toEqual({ success: true, folder: { id: String(insertedId), name: 'Short name' } });
        expect(await fileFolderModel.findById(insertedId).lean()).toMatchObject({ name: 'Short name', nameKey: 'short name' });
    });

    test("another student's folder, an unknown id and a bad id are all 404", async () => {
        const mine = await makeFolder(owner);
        const theirs = await makeFolder(other, 'Theirs');
        expect((await rename(owner, theirs._id, { name: 'Mine now' })).status).toBe(404);
        expect((await rename(other, mine._id, { name: 'Mine now' })).status).toBe(404);
        expect((await rename(owner, '507f1f77bcf86cd799439011', { name: 'x' })).status).toBe(404);
        expect((await rename(owner, 'nope', { name: 'x' })).status).toBe(404);
        expect((await fileFolderModel.findById(theirs._id).lean()).name).toBe('Theirs');
    });
});

describe('delete', () => {
    test('keep (the default) moves the files to General and lists them there', async () => {
        const folder = await makeFolder(owner);
        const row = await addFile(owner, { folder: String(folder._id) });
        const before = await usedBytes(owner);

        const res = await del(owner, `/api/files/folders/${folder._id}`);
        expect(res.body).toEqual({ success: true });
        expect(await fileFolderModel.exists({ _id: folder._id })).toBeNull();
        expect(await fileModel.findById(row._id).lean()).toMatchObject({ folder: null, subject: null, state: 'ready' });
        const general = await get(owner, '/api/files?in=general');
        expect(general.body.files.map((file) => file.id)).toEqual([String(row._id)]);
        expect(await usedBytes(owner)).toBe(before);
    });

    test('an explicit keep does the same', async () => {
        const folder = await makeFolder(owner);
        const row = await addFile(owner, { folder: String(folder._id) });
        expect((await del(owner, `/api/files/folders/${folder._id}?files=keep`)).status).toBe(200);
        expect((await fileModel.findById(row._id).lean()).folder).toBeNull();
    });

    test('delete removes the objects and gives the quota back, and leaves other files alone', async () => {
        const folder = await makeFolder(owner);
        const elsewhere = await makeFolder(owner, 'Elsewhere');
        await addFile(owner, { folder: String(folder._id) });
        await addFile(owner, { folder: String(folder._id) });
        const kept = await addFile(owner, { folder: String(elsewhere._id) });
        const general = await addFile(owner, {});
        const theirs = await addFile(other, {});

        const res = await del(owner, `/api/files/folders/${folder._id}?files=delete`);
        expect(res.status).toBe(200);
        expect(await fileModel.countDocuments({ owner: owner._id })).toBe(2);
        expect(await fileModel.exists({ _id: kept._id })).toBeTruthy();
        expect(await fileModel.exists({ _id: general._id })).toBeTruthy();
        expect(await fileModel.exists({ _id: theirs._id })).toBeTruthy();
        expect(await usedBytes(owner)).toBe(kept.bytes + general.bytes);
        expect(store.size()).toBe(3);
    });

    test('anything but keep or delete is a 400 and nothing changes', async () => {
        const folder = await makeFolder(owner);
        const row = await addFile(owner, { folder: String(folder._id) });
        for (const query of ['files=maybe', 'files=', 'files=keep&files=delete', 'files=DELETE']) {
            expect((await del(owner, `/api/files/folders/${folder._id}?${query}`)).status, query).toBe(400);
        }
        expect(await fileFolderModel.exists({ _id: folder._id })).toBeTruthy();
        expect(await fileModel.findById(row._id).lean()).toMatchObject({ folder: folder._id, state: 'ready' });
        expect(store.size()).toBe(1);
    });

    test("another student's folder, an unknown id and a bad id are all 404 and their files stay", async () => {
        const theirs = await makeFolder(other, 'Theirs');
        const row = await addFile(other, { folder: String(theirs._id) });
        for (const path of [`/api/files/folders/${theirs._id}`, `/api/files/folders/${theirs._id}?files=delete`, '/api/files/folders/507f1f77bcf86cd799439011', '/api/files/folders/nope']) {
            expect((await del(owner, path)).status).toBe(404);
        }
        expect(await fileFolderModel.exists({ _id: theirs._id })).toBeTruthy();
        expect(await fileModel.findById(row._id).lean()).toMatchObject({ folder: theirs._id, state: 'ready' });
    });

    test('a removing row is not counted or listed, and delete still takes it out', async () => {
        const folder = await makeFolder(owner);
        const row = await addFile(owner, { folder: String(folder._id) });
        await fileModel.updateOne({ _id: row._id }, { $set: { state: 'removing' } });
        expect((await del(owner, `/api/files/folders/${folder._id}?files=delete`)).status).toBe(200);
        expect(await fileModel.exists({ _id: row._id })).toBeNull();
    });
});
