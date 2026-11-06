import { describe, test, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import net from 'node:net';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../app.js';
import userAuth from '../middleware/userAuth.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { makeJpeg, makeOffice, makePng, makeWebp } from './helpers/fileFixtures.js';
import userModel from '../models/userModel.js';
import groupModel from '../models/groupMode.js';
import groupMessageModel from '../models/groupMessageModel.js';
import fileModel from '../models/fileModel.js';
import fileUsageModel from '../models/fileUsageModel.js';
import fileUserDayModel from '../models/fileUserDayModel.js';
import { monthId, nextMonthStart } from '../utils/fileBudget.js';
import { reloadFileLimits, setFileLimitsForTests } from '../utils/fileLimits.js';
import { setFileStoreForTests } from '../utils/fileStore.js';
import { createMemoryStore } from '../utils/fileStores/memoryStore.js';
import { sendFileError, sendFileLinks } from '../utils/fileResponse.js';
import { resetRateLimits } from '../utils/rateLimit.js';
import { storeFile } from '../utils/storedFiles.js';
import { fileUpload, uploadSlotsInUse } from '../utils/uploads.js';
import { isId } from '../utils/httpErrors.js';

vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
    sendOwnerAlertEmail: vi.fn().mockResolvedValue(undefined),
}));

const MIB = 1024 * 1024;

// --- A test-only router built from fileUpload and sendFileLinks, the way a feature route will use them ---

let gate = Promise.resolve(); // an upload handler waits here, so a test can hold uploads in flight

const notFound = (res) => res.status(404).json({ success: false, message: 'Not found.' });

// Members only; non-members get a 404 before any limit is spent or body read.
const loadGroup = async (req, res, next) => {
    if (!isId(req.params.groupId) || !(await groupModel.exists({ _id: req.params.groupId, members: req.userId }))) {
        req.resume();
        return notFound(res);
    }
    next();
};

// The rows for these ids, in order and with repeats; null when one is missing.
const loadRows = async (ids, filter) => {
    if (!Array.isArray(ids) || !ids.every(isId)) return null;
    const found = await fileModel.find({ _id: { $in: ids }, ...filter });
    const byId = new Map(found.map((row) => [String(row._id), row]));
    const rows = ids.map((id) => byId.get(id));
    return rows.every(Boolean) ? rows : null;
};

const testRouter = express.Router();
testRouter.post('/:groupId/upload', ...fileUpload({ loadParent: loadGroup }), async (req, res) => {
    try {
        await gate;
        const message = await groupMessageModel.create({ group: req.params.groupId, sender: req.userId, text: 'file' });
        const row = await storeFile({
            ownerId: req.userId, scope: 'chat', refs: { group: req.params.groupId, message: message._id }, file: req.upload.file, thumb: req.upload.thumb,
        });
        res.json({ success: true, file: { id: row._id, name: row.name, mimeType: row.mimeType, width: row.width, height: row.height } });
    } catch (error) {
        sendFileError(res, error, 'Test upload failed');
    }
});
// Subject files: a photo's preview is optional. The group stands in for the subject's owner check.
testRouter.post('/:groupId/subject-upload', ...fileUpload({ loadParent: loadGroup, requireThumb: false }), async (req, res) => {
    try {
        const row = await storeFile({
            ownerId: req.userId, scope: 'subject', refs: { subject: req.params.groupId }, file: req.upload.file, thumb: req.upload.thumb,
        });
        res.json({ success: true, file: { id: row._id, thumbSize: row.thumbSize } });
    } catch (error) {
        sendFileError(res, error, 'Test upload failed');
    }
});
testRouter.post('/:groupId/links', userAuth, loadGroup, async (req, res) => {
    const rows = await loadRows(req.body.ids, { group: req.params.groupId });
    if (!rows) return notFound(res);
    await sendFileLinks(req, res, rows, { variant: req.body.variant });
});
// Deliberately loads files with no parent check: sendFileLinks must still refuse what the student can't read.
testRouter.post('/any-file-links', userAuth, async (req, res) => {
    const rows = await loadRows(req.body.ids, {});
    if (!rows) return notFound(res);
    await sendFileLinks(req, res, rows, { variant: req.body.variant });
});
app.use('/test-files', testRouter);

// --- Setup ---

let store;
let logs;
let server;
let port;
beforeAll(async () => {
    await connectTestDB();
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => { server.once('listening', resolve); });
    port = server.address().port;
});
afterAll(async () => {
    server.close();
    reloadFileLimits();
    await closeTestDB();
});

const useLimits = (overrides = {}) => {
    setFileLimitsForTests(overrides);
    store = createMemoryStore();
    setFileStoreForTests(store);
};

let owner;
let member;
let outsider;
let group;
beforeEach(async () => {
    await clearTestDB();
    resetRateLimits();
    gate = Promise.resolve();
    logs = ['warn', 'log', 'error'].map((level) => vi.spyOn(console, level).mockImplementation(() => {}));
    useLimits();
    [owner, member, outsider] = await Promise.all(['a', 'b', 'c'].map((name) => userModel.create({ name, email: `${name}@student.fatima.edu.ph` })));
    group = await groupModel.create({ name: 'Study', admin: owner._id, members: [owner._id, member._id] });
});
afterEach(() => {
    vi.restoreAllMocks();
});

const cookieOf = (user) => `token=${jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET)}`;
const post = (user, path) => request(app).post(path).set('Cookie', cookieOf(user));
const month = async () => (await fileUsageModel.findById(monthId(new Date())).lean()) ?? {};
const pdfBytes = (size = 64) => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(size, 0x20)]);

const upload = (user, parts, groupId = group._id) => {
    const req = post(user, `/test-files/${groupId}/upload`);
    for (const [field, buffer, filename] of parts) req.attach(field, buffer, filename);
    return req;
};
const photoParts = (filename = 'photo.png') => [['file', makePng(), filename], ['thumb', makeJpeg(), 'thumb.jpg']];

const until = async (check) => {
    for (let waited = 0; waited < 3000 && !check(); waited += 20) await new Promise((resolve) => { setTimeout(resolve, 20); });
    expect(check()).toBe(true);
};

// A request written by hand, for what supertest can't send (no Content-Length, a body that is declared
// but never sent). The body is only ended when `end` is true; the request is dropped once the answer is in.
const rawPost = (path, user, headers, chunks = [], { end = true } = {}) => new Promise((resolve, reject) => {
    const req = http.request({
        host: '127.0.0.1', port, path, method: 'POST', headers: { cookie: cookieOf(user), 'content-type': 'multipart/form-data; boundary=x', ...headers },
    }, (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
            req.destroy();
        });
    });
    req.on('error', reject);
    chunks.forEach((chunk) => req.write(chunk));
    if (end) req.end();
});

// Stored files for the link tests, made straight through storeFile.
const messageIn = (inGroup = group) => groupMessageModel.create({ group: inGroup._id, sender: owner._id, text: 'file' });
const storeFor = async ({ kind = 'pdf', user = owner, inGroup = group } = {}) => {
    const message = await messageIn(inGroup);
    const photo = kind === 'png';
    return storeFile({
        ownerId: user._id,
        scope: 'chat',
        refs: { group: inGroup._id, message: message._id },
        file: photo
            ? { buffer: makePng(), name: 'photo.png', ext: 'png', mimeType: 'image/png', width: 4, height: 3 }
            : { buffer: pdfBytes(), name: 'notes.pdf', ext: 'pdf', mimeType: 'application/pdf' },
        thumb: photo ? { buffer: makeJpeg(), mimeType: 'image/jpeg' } : null,
    });
};
const askLinks = (user, ids, variant = 'file', path = `/test-files/${group._id}/links`) => post(user, path).send({ ids: ids.map(String), variant });

describe('uploading', () => {
    test('a photo with its preview is stored; the answer has no storage detail', async () => {
        const res = await upload(member, photoParts());
        expect(res.status).toBe(200);
        expect(res.body.file).toMatchObject({ name: 'photo.png', mimeType: 'image/png', width: 4, height: 3 });
        expect(JSON.stringify(res.body)).not.toMatch(/storageId|memory:/);
        expect(store.size()).toBe(2);
        await until(() => uploadSlotsInUse() === 0);
    });

    test('a document is stored, and a preview sent with it is ignored', async () => {
        const res = await upload(member, [['file', pdfBytes(), 'notes.pdf'], ['thumb', makeJpeg(), 'thumb.jpg']]);
        expect(res.status).toBe(200);
        expect(store.size()).toBe(1);
        expect(await fileModel.findById(res.body.file.id)).toMatchObject({ thumbStorageId: '', mimeType: 'application/pdf' });
    });

    test('the stored name is cleaned and the real extension forced; UTF-8 names survive', async () => {
        const tricky = await upload(member, [['file', pdfBytes(), '../../notes.pdf.exe']]);
        expect(tricky.body.file.name).toBe('notes.pdf');
        const thai = await upload(member, [['file', pdfBytes(), 'รายงาน.pdf']]);
        expect(thai.body.file.name).toBe('รายงาน.pdf');
    });

    test('signed out: Unauthorized, and nothing is read or stored', async () => {
        const res = await request(app).post(`/test-files/${group._id}/upload`).attach('file', pdfBytes(), 'notes.pdf');
        expect(res.body).toEqual({ success: false, message: 'Unauthorized' });
        expect(store.size()).toBe(0);
        expect(await month()).toEqual({});
    });

    test('not a member of the group: 404, no slot taken, no budget spent', async () => {
        const res = await upload(outsider, [['file', pdfBytes(), 'notes.pdf']]);
        expect(res.status).toBe(404);
        await until(() => uploadSlotsInUse() === 0);
        expect(store.size()).toBe(0);
        expect(await fileUserDayModel.countDocuments()).toBe(0);
    });

    test('a body without Content-Length is refused', async () => {
        const res = await rawPost(`/test-files/${group._id}/upload`, member, { 'transfer-encoding': 'chunked' }, ['--x--\r\n']);
        expect(res).toMatchObject({ status: 400, body: { code: 'bad_upload' } });
        await until(() => uploadSlotsInUse() === 0);
    });

    test('a Content-Length over 10 MB is refused before the body is read', async () => {
        const declared = { 'content-length': String(11 * MIB) };
        const res = await rawPost(`/test-files/${group._id}/upload`, member, declared, ['--x\r\n'], { end: false });
        expect(res.status).toBe(413);
        expect(res.body).toMatchObject({ code: 'too_big', message: 'That file is too big. The limit is 10 MB.' });
        await until(() => uploadSlotsInUse() === 0);
        expect(store.size()).toBe(0);
    });

    test('a file just over 10 MB that slips under the length check is stopped by multer', async () => {
        const res = await upload(member, [['file', Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(10 * MIB + 10 * 1024)]), 'big.pdf']]);
        expect(res.status).toBe(413);
        expect(res.body.code).toBe('too_big');
        expect(store.size()).toBe(0);
        await until(() => uploadSlotsInUse() === 0);
    });

    test('a student who is out of room is turned away before the body is read', async () => {
        await userModel.updateOne({ _id: member._id }, { $set: { storageUsedBytes: 100 * MIB - 100 } });
        const res = await upload(member, [['file', pdfBytes(1000), 'notes.pdf']]);
        expect(res.status).toBe(413);
        expect(res.body).toMatchObject({ code: 'quota_full', message: "You've used your 100 MB. Delete a file to make room." });
        expect(await month()).toEqual({});
    });

    test('the 3rd upload at once gets "busy", and every slot comes back', async () => {
        let release;
        gate = new Promise((resolve) => { release = resolve; });
        const held = [1, 2].map(() => upload(member, [['file', pdfBytes(), 'notes.pdf']]).then((res) => res));
        await until(() => uploadSlotsInUse() === 2);

        const third = await upload(member, [['file', pdfBytes(), 'notes.pdf']]);
        expect(third.status).toBe(503);
        expect(third.body).toMatchObject({ code: 'busy', message: 'Busy, try again in a moment.' });
        expect(uploadSlotsInUse()).toBe(2);

        release();
        const results = await Promise.all(held);
        expect(results.map((res) => res.status)).toEqual([200, 200]);
        await until(() => uploadSlotsInUse() === 0);
    });

    test('a connection dropped mid-upload gives its slot back, once', async () => {
        const socket = net.connect(port, '127.0.0.1');
        socket.write([
            `POST /test-files/${group._id}/upload HTTP/1.1`, 'Host: x', `Cookie: ${cookieOf(member)}`,
            'Content-Type: multipart/form-data; boundary=x', 'Content-Length: 5000', '', '--x\r\n',
        ].join('\r\n'));
        await until(() => uploadSlotsInUse() === 1);
        socket.destroy();
        await until(() => uploadSlotsInUse() === 0);
        await new Promise((resolve) => { setTimeout(resolve, 100); });
        await until(() => uploadSlotsInUse() === 0);
    });

    test('the 21st upload in 10 minutes is told to slow down', async () => {
        for (let i = 0; i < 20; i += 1) {
            const res = await post(member, `/test-files/${group._id}/upload`).send('');
            expect(res.status).toBe(400);
        }
        const res = await post(member, `/test-files/${group._id}/upload`).send('');
        expect(res.status).toBe(429);
        expect(res.body).toMatchObject({ code: 'slow_down', message: 'Slow down a little.' });
        expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    });

    test('files off: 503 files_off, nothing read', async () => {
        useLimits({ availability: { on: false, store: null, reason: 'disabled' } });
        const res = await upload(member, [['file', pdfBytes(), 'notes.pdf']]);
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('files_off');
    });

    test('a request with no file part is refused', async () => {
        const res = await post(member, `/test-files/${group._id}/upload`).field('caption', 'hi');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('bad_upload');
    });

    describe('content checks', () => {
        const refused = async (parts, code) => {
            const res = await upload(member, parts);
            expect(res.body).toMatchObject({ success: false, code });
            expect(store.size()).toBe(0);
            expect(await fileModel.countDocuments()).toBe(0);
            expect(await month()).toEqual({});
            await until(() => uploadSlotsInUse() === 0);
        };

        test.each([
            ['HTML named .pdf', () => [['file', Buffer.from('<html><script>alert(1)</script></html>'), 'a.pdf']]],
            ['SVG named photo.png', () => [['file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'photo.png'], ['thumb', makeJpeg(), 't.jpg']]],
            ['a GIF', () => [['file', Buffer.from('GIF89a......'), 'a.gif']]],
            ['a Word file that is not one', () => [['file', Buffer.from('PK\x03\x04 not really'), 'a.docx']]],
        ])('%s is refused with bad_type', (name, parts) => refused(parts(), 'bad_type'));

        test('a PNG signature followed by HTML is refused (imageInfo runs on every image)', () => refused([
            ['file', Buffer.concat([makePng().subarray(0, 8), Buffer.from('<html><script>alert(1)</script></html>')]), 'photo.png'],
            ['thumb', makeJpeg(), 't.jpg'],
        ], 'bad_type'));

        test('a 65535 px wide JPEG is refused', () => refused([['file', makeJpeg(65535, 3), 'wide.jpg'], ['thumb', makeJpeg(), 't.jpg']], 'bad_type'));

        test('a 50,000 x 50,000 PNG is refused', () => refused([['file', makePng(50000, 50000), 'huge.png'], ['thumb', makeJpeg(), 't.jpg']], 'bad_type'));

        test('a photo needs a real JPEG or WebP preview', async () => {
            await refused([['file', makePng(), 'photo.png']], 'bad_upload');
            await refused([['file', makePng(), 'photo.png'], ['thumb', makePng(), 't.png']], 'bad_upload');
            await refused([['file', makePng(), 'photo.png'], ['thumb', Buffer.from('<html></html>'), 't.jpg']], 'bad_upload');
            await refused([['file', makePng(), 'photo.png'], ['thumb', Buffer.concat([makeJpeg(), Buffer.alloc(101 * 1024)]), 't.jpg']], 'bad_upload');
            const ok = await upload(member, [['file', makePng(), 'photo.png'], ['thumb', makeWebp(), 't.webp']]);
            expect(ok.status).toBe(200);
        });

        test('a subject photo may skip its preview, but a preview that is sent must be real', async () => {
            const path = `/test-files/${group._id}/subject-upload`;
            const bare = await post(member, path).attach('file', makePng(), 'photo.png');
            expect(bare.status).toBe(200);
            expect(bare.body.file.thumbSize).toBe(0);
            expect(store.size()).toBe(1);

            const withThumb = await post(member, path).attach('file', makePng(), 'photo.png').attach('thumb', makeJpeg(), 't.jpg');
            expect(withThumb.body.file.thumbSize).toBeGreaterThan(0);
            expect(store.size()).toBe(3);

            const badThumb = await post(member, path).attach('file', makePng(), 'photo.png').attach('thumb', makePng(), 't.png');
            expect(badThumb.body).toMatchObject({ success: false, code: 'bad_upload' });
            const badImage = await post(member, path).attach('file', Buffer.concat([makePng().subarray(0, 8), Buffer.from('<html>')]), 'photo.png');
            expect(badImage.body).toMatchObject({ success: false, code: 'bad_type' });
            expect(store.size()).toBe(3);
            await until(() => uploadSlotsInUse() === 0);
        });

        test('a macro-enabled Office file is refused, a plain one is kept', async () => {
            await refused([['file', makeOffice('docx', ['word/vbaProject.bin']), 'macro.docx']], 'bad_type');
            expect((await upload(member, [['file', makeOffice('docx'), 'essay.docx']])).status).toBe(200);
        });
    });
});

describe('links', () => {
    test('three ids give three links, uncached, with an expiry', async () => {
        const rows = [await storeFor({ kind: 'png' }), await storeFor(), await storeFor()];
        const res = await askLinks(member, rows.map((row) => row._id));
        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body.links).toHaveLength(3);
        expect(res.body.links.map((link) => link.id)).toEqual(rows.map((row) => String(row._id)));
        for (const link of res.body.links) {
            expect(link.url).toMatch(/^\/api\/files\/dev\//);
            expect(new Date(link.expiresAt).getTime()).toBeGreaterThan(Date.now());
        }
        expect(JSON.stringify(res.body)).not.toMatch(/storageId|memory:|sha256/);
        expect((await month()).classB).toBe(3);
    });

    test('a photo link serves the image inline and cacheable; a PDF link downloads and is not cached', async () => {
        const photo = await storeFor({ kind: 'png' });
        const doc = await storeFor();
        const { body } = await askLinks(member, [photo._id, doc._id]);

        const image = await request(app).get(body.links[0].url);
        expect(image.status).toBe(200);
        expect(image.headers['content-type']).toBe('image/png');
        expect(image.headers['content-disposition']).toMatch(/^inline; /);
        expect(image.headers['cache-control']).toBe('private, max-age=86400, immutable');

        const file = await request(app).get(body.links[1].url);
        expect(file.status).toBe(200);
        expect(file.headers['content-type']).toBe('application/pdf');
        expect(file.headers['content-disposition']).toMatch(/^attachment; /);
        expect(file.headers['cache-control']).toBe('private, no-store');
    });

    test('the thumbnail variant links the preview', async () => {
        const photo = await storeFor({ kind: 'png' });
        const { body } = await askLinks(member, [photo._id], 'thumb');
        const res = await request(app).get(body.links[0].url);
        expect(res.headers['content-type']).toBe('image/jpeg');
        expect(res.headers['content-disposition']).toMatch(/^inline; /);
        expect((await askLinks(member, [(await storeFor())._id], 'thumb')).status).toBe(404);
    });

    test('an expired link answers 403 and costs nothing more', async () => {
        const doc = await storeFor();
        const { body } = await askLinks(member, [doc._id]);
        const before = (await month()).classB;

        const realNow = Date.now();
        vi.spyOn(Date, 'now').mockReturnValue(realNow + 61 * 1000);
        const late = await request(app).get(body.links[0].url);
        vi.mocked(Date.now).mockRestore();

        expect(late.status).toBe(403);
        expect((await month()).classB).toBe(before);
    });

    test('a link used again inside its life works each time and counts once (documents the design)', async () => {
        const doc = await storeFor();
        const { body } = await askLinks(member, [doc._id]);
        for (let i = 0; i < 3; i += 1) expect((await request(app).get(body.links[0].url)).status).toBe(200);
        expect((await month()).classB).toBe(1);
        expect(store.devReads((await fileModel.findById(doc._id)).storageId.replace('memory:', ''))).toBe(3);
    });

    test('a changed link, or one for a deleted file, is refused', async () => {
        const doc = await storeFor();
        const { body } = await askLinks(member, [doc._id]);
        const url = body.links[0].url;
        expect((await request(app).get(`${url.slice(0, -1)}${url.endsWith('A') ? 'B' : 'A'}`)).status).toBe(403);
        await store.remove((await fileModel.findById(doc._id)).storageId.replace('memory:', ''));
        expect((await request(app).get(url)).status).toBe(404);
    });

    test('a GET on the link route is a 404', async () => {
        const res = await request(app).get(`/test-files/${group._id}/links`).set('Cookie', cookieOf(member));
        expect(res.status).toBe(404);
    });

    test('a student outside the group gets a 404 and spends nothing', async () => {
        const doc = await storeFor();
        const res = await askLinks(outsider, [doc._id]);
        expect(res.status).toBe(404);
        expect((await month()).classB).toBe(0);
    });

    test('canRead is checked for every row inside sendFileLinks, even when the route forgot its own check', async () => {
        const mine = await storeFor();
        const hidden = await storeFor({ inGroup: await groupModel.create({ name: 'Other', admin: owner._id, members: [owner._id] }) });
        const path = '/test-files/any-file-links';

        const res = await askLinks(member, [mine._id, hidden._id], 'file', path);
        expect(res.status).toBe(404);
        expect(res.body.links).toBeUndefined();
        expect((await month()).classB).toBe(0);
        expect(await fileUserDayModel.countDocuments({ links: { $gt: 0 } })).toBe(0);

        expect((await askLinks(member, [mine._id], 'file', path)).status).toBe(200);
    });

    test('a deleted message closes its file', async () => {
        const doc = await storeFor();
        await groupMessageModel.updateOne({ _id: doc.message }, { $set: { deletedAt: new Date() } });
        expect((await askLinks(member, [doc._id])).status).toBe(404);
    });

    test('bad ids and more than 24 files are refused before any budget is spent', async () => {
        const doc = await storeFor();
        expect((await askLinks(member, ['nope'])).status).toBe(404);
        const many = await askLinks(member, Array(25).fill(doc._id));
        expect(many.status).toBe(400);
        expect(many.body.code).toBe('too_many');
        expect((await month()).classB).toBe(0);
    });

    test('a huge id list is refused before any per-row access check', async () => {
        const doc = await storeFor();
        const messageLookups = vi.spyOn(groupMessageModel, 'exists');
        const res = await askLinks(member, Array(2000).fill(doc._id));
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('too_many');
        expect(messageLookups).not.toHaveBeenCalled();
        expect((await month()).classB).toBe(0);
    });

    test('the 121st link request in 10 minutes is told to slow down', async () => {
        const doc = await storeFor();
        for (let i = 0; i < 120; i += 1) expect((await askLinks(member, [doc._id])).status).toBe(200);
        const res = await askLinks(member, [doc._id]);
        expect(res.status).toBe(429);
        expect(res.body.code).toBe('slow_down');
        expect(res.headers['retry-after']).toBeDefined();
        expect(res.headers['cache-control']).toBe('no-store');
    });

    test('400 links a day pass; the next request is a daily limit', async () => {
        const doc = await storeFor();
        for (let i = 0; i < 16; i += 1) expect((await askLinks(member, Array(24).fill(doc._id))).status).toBe(200);
        expect((await askLinks(member, Array(16).fill(doc._id))).status).toBe(200);
        const res = await askLinks(member, [doc._id]);
        expect(res.status).toBe(429);
        expect(res.body).toMatchObject({ code: 'daily_limit', message: "You've opened a lot of files today. Try again tomorrow." });
        expect((await month()).classB).toBe(400);
    });

    test('a batch that would pass the daily limit issues none of its links', async () => {
        const doc = await storeFor();
        await fileUserDayModel.create({ user: member._id, day: new Date().toISOString().slice(0, 10), links: 390 });
        const res = await askLinks(member, Array(11).fill(doc._id));
        expect(res.status).toBe(429);
        expect(res.body.links).toBeUndefined();
        expect((await month()).classB ?? 0).toBe(0);
    });

    test('the monthly read cap answers files_paused with the date it clears', async () => {
        useLimits({ classBMonthlyCap: 2 });
        const doc = await storeFor();
        const res = await askLinks(member, Array(3).fill(doc._id));
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('files_paused');
        expect(res.body.message).toMatch(/^Files can't be opened until [A-Z][a-z]+ \d{1,2} so StressCare stays free/);
        expect(res.body.resumesAt).toBe(nextMonthStart(new Date()).toISOString());
        expect((await month()).classB).toBe(0);
    });

    test('tripped reads answer files_paused at once, while uploads still work', async () => {
        const doc = await storeFor();
        await fileUsageModel.updateOne({ _id: monthId(new Date()) }, { $set: { 'tripped.reads': 'uncounted_reads' } });
        const before = (await month()).classB;
        const res = await askLinks(member, [doc._id]);
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('files_paused');
        expect((await month()).classB).toBe(before);
        expect((await upload(member, [['file', pdfBytes(), 'notes.pdf']])).status).toBe(200);
    });

    test('files off: 503 files_off', async () => {
        const doc = await storeFor();
        useLimits({ availability: { on: false, store: null, reason: 'disabled' } });
        const res = await askLinks(member, [doc._id]);
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('files_off');
    });

    test('no link, token or signature is ever logged', async () => {
        const doc = await storeFor();
        const { body } = await askLinks(member, [doc._id]);
        await request(app).get(body.links[0].url);
        await askLinks(outsider, [doc._id]);
        const token = body.links[0].url.split('/').pop();
        const printed = logs.flatMap((spy) => spy.mock.calls).map((args) => args.map(String).join(' ')).join('\n');
        expect(printed).not.toContain(token.slice(0, 20));
        expect(printed).not.toContain('/api/files/dev');
    });
});

describe('the dev link route', () => {
    test('is not mounted in production', async () => {
        vi.resetModules();
        vi.stubEnv('NODE_ENV', 'production');
        const { default: productionRouter } = await import('../routes/fileRoutes.js');
        vi.unstubAllEnvs();
        const productionApp = express().use('/api/files', productionRouter);

        const res = await request(productionApp).get('/api/files/dev/anything.at-all');
        expect(res.status).toBe(404);
        expect(res.headers['content-type']).toMatch(/html/); // Express's own "no such route", not our JSON
    });

    test('is mounted outside production, and a made-up token is refused', async () => {
        const res = await request(app).get('/api/files/dev/anything.at-all');
        expect(res.status).toBe(403);
    });
});
