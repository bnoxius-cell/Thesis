import { describe, test, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app.js';
import reviewerModel from '../models/reviewerModel.js';
import aiRequestModel from '../models/aiRequestModel.js';
import userModel from '../models/userModel.js';
import fileModel from '../models/fileModel.js';
import groupModel from '../models/groupMode.js';
import groupMessageModel from '../models/groupMessageModel.js';
import fileUsageModel from '../models/fileUsageModel.js';
import fileUserDayModel from '../models/fileUserDayModel.js';
import { generateJson, isGeminiConfigured } from '../utils/gemini.js';
import { extractDocxText } from '../utils/officeText.js';
import { generationSettings, settleGenerationJobs, DAILY_GENERATION_LIMIT } from '../controllers/reviewerController.js';
import { sourceSlots } from '../utils/reviewerSource.js';
import { monthId } from '../utils/fileBudget.js';
import { detectFileType } from '../utils/fileTypes.js';
import { reloadFileLimits, setFileLimitsForTests } from '../utils/fileLimits.js';
import { setFileStoreForTests } from '../utils/fileStore.js';
import { createMemoryStore } from '../utils/fileStores/memoryStore.js';
import { removeFiles, storeFile } from '../utils/storedFiles.js';
import { resetRateLimits } from '../utils/rateLimit.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';
import { makeDocx, makeOffice, makePng, makePptx, makeZip } from './helpers/fileFixtures.js';
import { STUDY_LINES, makeImageOnlyPdf, makePagedPdf, makePdf } from './helpers/pdf.js';

vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
    sendOwnerAlertEmail: vi.fn().mockResolvedValue(undefined),
}));
// The real Word reader, but counted, to show a double submit never reaches it.
vi.mock('../utils/officeText.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, extractDocxText: vi.fn(actual.extractDocxText) };
});
vi.mock('../utils/gemini.js', () => ({
    generateJson: vi.fn(),
    isGeminiConfigured: vi.fn(() => true),
}));

const MIB = 1024 * 1024;

const aiOutput = () => ({
    summary: 'How plants make sugar and how cells use it.',
    topics: [{ name: 'Photosynthesis', summary: 'Light to sugar.' }, { name: 'Respiration', summary: 'Sugar to ATP.' }],
    keyPoints: ['Chlorophyll absorbs red and blue light.'],
    keyTerms: [{ term: 'RuBisCO', definition: 'The enzyme that captures carbon dioxide.' }],
    questions: [
        ['Photosynthesis', 'Where do the light-dependent reactions happen?', ['Thylakoid membranes', 'Stroma', 'Cytoplasm', 'Nucleus']],
        ['Photosynthesis', 'What does chlorophyll absorb?', ['Red and blue light', 'Only green light', 'Heat', 'Oxygen']],
        ['Photosynthesis', 'Where does the Calvin cycle happen?', ['Stroma', 'Thylakoid', 'Cytoplasm', 'Matrix']],
        ['Respiration', 'Where does glycolysis happen?', ['Cytoplasm', 'Nucleus', 'Stroma', 'Matrix']],
        ['Respiration', 'What is the final electron acceptor?', ['Oxygen', 'Carbon dioxide', 'Water', 'Glucose']],
        ['Respiration', 'What happens without oxygen?', ['Fermentation', 'More ATP', 'Photosynthesis', 'Nothing']],
    ].map(([topic, prompt, options]) => ({ topic, prompt, options, correctIndex: 0, explanation: `Because: ${options[0]}.`, difficulty: 'medium' })),
});

let store;
let logs;

// Limits with some values replaced, and a fresh memory store (a limits change drops the old one).
const useLimits = (overrides = {}) => {
    reloadFileLimits();
    if (Object.keys(overrides).length) setFileLimitsForTests(overrides);
    store = createMemoryStore();
    setFileStoreForTests(store);
};

beforeAll(async () => {
    generationSettings.retryDelaysMs = [0, 0, 0];
    await connectTestDB();
});
beforeEach(async () => {
    await clearTestDB();
    resetRateLimits();
    useLimits();
    generateJson.mockReset();
    generateJson.mockResolvedValue({ data: aiOutput(), model: 'gemini-test' });
    isGeminiConfigured.mockReturnValue(true);
    logs = ['warn', 'error'].map((level) => vi.spyOn(console, level).mockImplementation(() => {}));
});
afterEach(async () => {
    await settleGenerationJobs();
    logs.forEach((spy) => spy.mockRestore());
});
afterAll(async () => {
    reloadFileLimits();
    await closeTestDB();
});

// --- helpers ---

let userCount = 0;
const signUp = async () => {
    userCount += 1;
    const email = `student${userCount}@student.fatima.edu.ph`;
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email, name: `Student ${userCount}` }));
    const user = await userModel.findOne({ email });
    return { agent, user };
};

// files: [[buffer, filename]]; fields: { name: value }
const send = (agent, { files = [], fields = {}, field = 'files' } = {}) => {
    let req = agent.post('/api/reviewers');
    for (const [key, value] of Object.entries(fields)) req = req.field(key, value);
    for (const [buffer, filename] of files) req = req.attach(field, buffer, { filename });
    return req;
};

const jsonOf = (agent, body) => agent.post('/api/reviewers').send(body);

const pdf = () => makePdf(STUDY_LINES);
const docx = () => makeDocx(STUDY_LINES);
const pptx = () => makePptx([STUDY_LINES.slice(0, 7), STUDY_LINES.slice(7)]);

const MIME = { pdf: 'application/pdf', docx: 'x', pptx: 'x', png: 'image/png', xlsx: 'x' };
const libraryFile = (user, buffer, name) => {
    const type = detectFileType(buffer, name);
    return storeFile({
        ownerId: user._id, scope: 'library', file: { buffer, name, ext: type.ext, mimeType: type.mimeType || MIME[type.ext], width: 0, height: 0 },
    });
};
const storedProps = async (user) => ({
    objects: store.size(),
    storageUsedBytes: (await userModel.findById(user._id).lean()).storageUsedBytes,
    links: (await fileUserDayModel.findOne({ user: user._id }).lean())?.links ?? 0,
    classB: (await fileUsageModel.findById(monthId(new Date())).lean())?.classB ?? 0,
});

const textOf = async (id) => (await reviewerModel.findById(id).select('+sourceText')).sourceText;
const noReviewerMade = async () => {
    expect(await reviewerModel.countDocuments()).toBe(0);
    expect(await aiRequestModel.countDocuments()).toBe(0);
    expect(generateJson).not.toHaveBeenCalled();
};
const slotsFree = () => vi.waitFor(() => expect(sourceSlots.inUse()).toBe(0));

let server;
let port;
beforeAll(async () => {
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => { server.once('listening', resolve); });
    port = server.address().port;
});
afterAll(() => new Promise((resolve) => { server.close(resolve); }));

// A request written by hand, for what supertest can't send (no Content-Length, or a length that is far
// bigger than the body that follows). The request is dropped once the answer is in.
const rawPost = (user, headers) => new Promise((resolve, reject) => {
    const token = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET);
    const req = http.request({
        host: '127.0.0.1', port, path: '/api/reviewers', method: 'POST',
        headers: { cookie: `token=${token}`, 'content-type': 'multipart/form-data; boundary=x', ...headers },
    }, (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
            req.destroy();
        });
    });
    req.on('error', reject);
    req.flushHeaders();
});

// --- Word and PowerPoint ---

describe('one Word or PowerPoint file', () => {
    test('a Word file gives a docx reviewer made from its text', async () => {
        const { agent } = await signUp();
        const res = await send(agent, { files: [[docx(), 'Cell notes.docx']] });
        expect(res.status).toBe(201);
        expect(res.body.reviewer.title).toBe('Cell notes');
        expect(res.body.reviewer.source).toMatchObject({ type: 'docx', fileName: 'Cell notes.docx', count: 1, truncated: false });
        expect(res.body.reviewer.source.items).toEqual([expect.objectContaining({ type: 'docx', fileName: 'Cell notes.docx', fileId: null })]);
        await settleGenerationJobs();
        expect(generateJson.mock.calls[0][0].prompt).toContain('RuBisCO captures carbon dioxide');
        expect(await textOf(res.body.reviewer._id)).toBe(STUDY_LINES.join('\n'));
    });

    test('a PowerPoint file keeps its slide count and the show order', async () => {
        const { agent } = await signUp();
        const slides = [['First slide in the files.', ...STUDY_LINES.slice(0, 5)], ['Second slide in the files.', ...STUDY_LINES.slice(5, 10)]];
        const res = await send(agent, { files: [[makePptx(slides, { order: [1, 0] }), 'Lecture 3.pptx']] });
        expect(res.status).toBe(201);
        expect(res.body.reviewer.source).toMatchObject({ type: 'pptx', slides: 2 });
        await settleGenerationJobs();
        const text = await textOf(res.body.reviewer._id);
        expect(text.indexOf('Second slide')).toBeLessThan(text.indexOf('First slide'));
    });

    test('a title typed in the form wins; a file name loses its extension', async () => {
        const { agent } = await signUp();
        expect((await send(agent, { files: [[docx(), 'my_notes.v2.docx']] })).body.reviewer.title).toBe('my notes.v2');
        expect((await send(agent, { files: [[docx(), 'other.docx']], fields: { title: ' Midterm ' } })).body.reviewer.title).toBe('Midterm');
    });
});

describe('several files in one reviewer', () => {
    test('a PDF, a Word file and a PowerPoint file become one mixed reviewer in that order', async () => {
        const { agent } = await signUp();
        const res = await send(agent, { files: [[pdf(), 'one.pdf'], [docx(), 'two.docx'], [pptx(), 'three.pptx']] });
        expect(res.status).toBe(201);
        const { source } = res.body.reviewer;
        expect(source).toMatchObject({ type: 'mixed', count: 3, fileName: 'one.pdf' });
        expect(source.items.map((item) => [item.type, item.fileName])).toEqual([['pdf', 'one.pdf'], ['docx', 'two.docx'], ['pptx', 'three.pptx']]);
        expect(res.body.reviewer.title).toBe('one');

        await settleGenerationJobs();
        const text = await textOf(res.body.reviewer._id);
        const at = [1, 2, 3].map((n, i) => text.indexOf(`Source ${n}: ${['one.pdf', 'two.docx', 'three.pptx'][i]}`));
        expect(at.every((i) => i >= 0)).toBe(true);
        expect(at).toEqual([...at].sort((a, b) => a - b));
        const stored = await reviewerModel.findById(res.body.reviewer._id);
        expect(stored.sources.map((item) => item.type)).toEqual(['pdf', 'docx', 'pptx']);
    });

    test('10 files are fine; 11 are not', async () => {
        const { agent } = await signUp();
        const ten = Array.from({ length: 10 }, (_, i) => [docx(), `part${i}.docx`]);
        const ok = await send(agent, { files: ten });
        expect(ok.status).toBe(201);
        expect(ok.body.reviewer.source.count).toBe(10);
        await settleGenerationJobs();

        const aiBefore = await aiRequestModel.countDocuments();
        const eleven = await send(agent, { files: [...ten, [docx(), 'part10.docx']] });
        expect(eleven.status).toBe(400);
        expect(eleven.body.message).toBe('You can add up to 10 files to one reviewer.');
        expect(await aiRequestModel.countDocuments()).toBe(aiBefore);
        await slotsFree();
    });

    test('two long texts share the limit: both stay, the longer is cut more', async () => {
        const { agent } = await signUp();
        const lines = (letter, n) => Array.from({ length: n }, (_, i) => `${letter} paragraph ${i} ${'word '.repeat(19)}`);
        const res = await send(agent, { files: [[makeDocx(lines('alpha', 3000)), 'big.docx'], [makeDocx(lines('bravo', 2000)), 'mid.docx']] });
        expect(res.status).toBe(201);
        await settleGenerationJobs();
        const text = await textOf(res.body.reviewer._id);
        expect(text.length).toBeLessThanOrEqual(360000);
        expect(text).toContain('Source 1: big.docx');
        expect(text).toContain('Source 2: mid.docx');
        expect(text).toContain('alpha paragraph 0');
        expect(text).toContain('bravo paragraph 0');
        const stored = await reviewerModel.findById(res.body.reviewer._id);
        expect(stored.sources.map((item) => item.truncated)).toEqual([true, true]);
        expect(stored.sources[0].chars).toBeGreaterThan(stored.sources[1].chars);
        expect(res.body.reviewer.source.truncated).toBe(true);
    });
});

// --- body size ---

describe('how much can be sent', () => {
    test('a declared body over 20 MB is refused before anything is read', async () => {
        const { user } = await signUp();
        const res = await rawPost(user, { 'content-length': String(25 * MIB) });
        expect(res.status).toBe(413);
        expect(res.body.message).toBe('Those files are too big together. The limit is 20 MB for one reviewer.');
        await slotsFree();
        await noReviewerMade();
    });

    test('a body with no length is refused', async () => {
        const { user } = await signUp();
        const res = await rawPost(user, { 'transfer-encoding': 'chunked' });
        expect(res.status).toBe(411);
        expect(res.body.message).toBe("The upload didn't go through. Try again.");
        await slotsFree();
    });

    test('files that fit one by one but not together are 413, with nothing saved', async () => {
        const { agent } = await signUp();
        const padded = (size) => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(size - 9, 0x20)]);
        const res = await send(agent, { files: [[padded(10 * MIB), 'a.pdf'], [padded(10 * MIB), 'b.pdf'], [padded(2000), 'c.pdf']] });
        expect(res.status).toBe(413);
        expect(res.body.message).toBe('Those files are too big together. The limit is 20 MB for one reviewer.');
        await slotsFree();
        await noReviewerMade();
    });

    test('one file over 10 MB is 413 and gives its slot back', async () => {
        const { agent } = await signUp();
        const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(10 * MIB)]);
        const res = await send(agent, { files: [[docx(), 'fine.docx'], [big, 'big.pdf']] });
        expect(res.status).toBe(413);
        expect(res.body.message).toBe('One of the files is too big. Each file can be up to 10 MB.');
        await slotsFree();
        await noReviewerMade();
    });
});

// --- types ---

describe('files that cannot be a source', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const cases = [
        ['an Excel file', makeOffice('xlsx'), 'sheet.xlsx'],
        ['a text file', Buffer.from('just plain text, not a source'), 'notes.txt'],
        ['a GIF', Buffer.from('GIF89a\u0001\u0000\u0001\u0000', 'latin1'), 'anim.gif'],
        ['an SVG named .png', svg, 'logo.png'],
        ['a Word file with macros', makeOffice('docx', ['word/vbaProject.bin']), 'macro.docx'],
        ['a ZIP named .docx without a word folder', makeZip(['[Content_Types].xml', 'other/file.xml']), 'fake.docx'],
    ];

    test.each(cases)('%s is 400 and names the file', async (_, buffer, name) => {
        const { agent } = await signUp();
        const res = await send(agent, { files: [[docx(), 'good.docx'], [buffer, name]] });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe(`${name} can't be made into a reviewer. Use PDF, Word or PowerPoint files, or photos (PNG, JPG or WebP).`);
        await slotsFree();
        await noReviewerMade();
    });

    test('an old or password-protected Word file is 422', async () => {
        const { agent } = await signUp();
        const ole = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(200)]);
        const res = await send(agent, { files: [[ole, 'notes.docx']] });
        expect(res.status).toBe(422);
        expect(res.body.message).toMatch(/^We can't open notes\.docx\./);
        await noReviewerMade();
    });

    test('photos and scanned PDFs are not read yet', async () => {
        const { agent } = await signUp();
        for (const files of [[[makePng(), 'photo.png']], [[docx(), 'a.docx'], [makePng(), 'photo.png']], [[makeImageOnlyPdf(), 'scan.pdf']]]) {
            const res = await send(agent, { files });
            expect(res.status).toBe(422);
            expect(res.body.message).toBe("Photos and scanned PDFs can't be read yet.");
        }
        await noReviewerMade();
    });

    test('damaged, locked and oversized files name the file; nothing is saved', async () => {
        const { agent } = await signUp();
        const huge = makeZip(['[Content_Types].xml', { name: 'word/document.xml', data: `<w:t>${'a'.repeat(26 * MIB)}</w:t>`, deflate: true }]);
        const cases = [
            [makeZip(['[Content_Types].xml', 'word/styles.xml']), 'empty.docx', 422, "We couldn't read empty.docx. It may be damaged. Try saving it again, or as a PDF."],
            [makePagedPdf([STUDY_LINES], { encrypt: true }), 'locked.pdf', 422, 'locked.pdf is password protected. Remove the password and add it again.'],
            [huge, 'huge.docx', 422, 'huge.docx is too big inside for us to read. Try saving it as a PDF, or split it.'],
            [makePagedPdf(Array.from({ length: 16 }, () => ['x'])), 'long scan.pdf', 422, 'long scan.pdf looks scanned and has more than 15 pages. Split it into parts of 15 pages or fewer.'],
        ];
        for (const [buffer, name, status, message] of cases) {
            const res = await send(agent, { files: [[buffer, name]] });
            expect(res.status, name).toBe(status);
            expect(res.body.message, name).toBe(message);
        }
        await noReviewerMade();
    });

    test('too little text: the message fits one file or several', async () => {
        const { agent } = await signUp();
        const few = ['A few words only.'];
        // A PDF this short counts as scanned for now, so the PDF case is Word and PowerPoint only.
        expect((await send(agent, { files: [[makeDocx(few), 'a.docx']] })).body.message).toBe("This Word file doesn't have enough text to make a reviewer.");
        expect((await send(agent, { files: [[makePptx([few]), 'a.pptx']] })).body.message)
            .toBe("These slides don't have enough text to make a reviewer. If they're mostly pictures, add photos of them instead.");
        const several = await send(agent, { files: [[makeDocx(few), 'a.docx'], [makePptx([few]), 'b.pptx']] });
        expect(several.status).toBe(422);
        expect(several.body.message).toBe("These files don't have enough text to make a reviewer.");
        await noReviewerMade();
    });
});

// --- which kind of source ---

describe('which kind of source', () => {
    test('nothing, or two kinds at once, is 400', async () => {
        const { agent } = await signUp();
        const { _id } = await libraryFile((await userModel.findOne()), pdf(), 'a.pdf');
        const notes = 'Study notes about plants. '.repeat(20);
        const none = [await send(agent, { fields: { title: 'x' } }), await jsonOf(agent, {}), await send(agent, { fields: { notes: '  ', fileIds: '' } })];
        for (const res of none) {
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Add a file or paste your notes to make a reviewer.');
        }
        const both = [
            await send(agent, { files: [[docx(), 'a.docx']], fields: { notes } }),
            await send(agent, { fields: { fileIds: String(_id), notes } }),
            await send(agent, { files: [[docx(), 'a.docx']], fields: { fileIds: String(_id) } }),
        ];
        for (const res of both) {
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Pick one source: upload files, choose from your study files, or paste notes.');
        }
        await noReviewerMade();
    });

    test('the old pdf field still works', async () => {
        const { agent } = await signUp();
        const res = await send(agent, { files: [[pdf(), 'Old client.pdf']], field: 'pdf' });
        expect(res.status).toBe(201);
        expect(res.body.reviewer.source).toMatchObject({ type: 'pdf', fileName: 'Old client.pdf', count: 1, pages: 1 });
    });

    test('a field sent twice, or a JSON body with the wrong shapes, is 400 and never a crash', async () => {
        const { agent } = await signUp();
        const twice = await agent.post('/api/reviewers').field('fileIds', 'a'.repeat(24)).field('fileIds', 'b'.repeat(24));
        expect(twice.status).toBe(400);
        const wrongField = await agent.post('/api/reviewers').attach('photo', docx(), { filename: 'a.docx' });
        expect(wrongField.status).toBe(400);
        expect(wrongField.body.message).toBe("The upload didn't go through. Try again.");
        const notesTwice = await agent.post('/api/reviewers').field('notes', 'x'.repeat(400)).field('notes', 'y'.repeat(400));
        expect(notesTwice.status).toBe(400);
        for (const body of [{ notes: 5 }, { notes: ['a', 'b'] }, { fileIds: ['a'.repeat(24)] }, { fileIds: { $ne: null } }, { notes: { $gt: '' } }]) {
            const res = await jsonOf(agent, body);
            expect(res.status, JSON.stringify(body)).toBe(400);
            expect(res.body.success).toBe(false);
        }
        await noReviewerMade();
    });

    test('no Gemini key, a bad count and the daily limit are checked before the source', async () => {
        const { agent, user } = await signUp();
        const notes = 'Study notes about plants. '.repeat(20);
        isGeminiConfigured.mockReturnValue(false);
        expect((await send(agent, { fields: { notes } })).status).toBe(503);
        isGeminiConfigured.mockReturnValue(true);
        expect((await send(agent, { fields: { notes, questionCount: '7' } })).status).toBe(400);
        await aiRequestModel.insertMany(Array.from({ length: DAILY_GENERATION_LIMIT }, () => ({ user: user._id })));
        const limited = await send(agent, { fields: { notes } });
        expect(limited.status).toBe(429);
        expect(await reviewerModel.countDocuments()).toBe(0);
    });
});

// --- pasted notes ---

describe('pasted notes', () => {
    test('299 characters is 400 and 100,001 is 413', async () => {
        const { agent } = await signUp();
        const short = await send(agent, { fields: { notes: 'a'.repeat(299) } });
        expect(short.status).toBe(400);
        expect(short.body.message).toBe('Add a bit more. Notes need at least 300 characters.');
        const long = await send(agent, { fields: { notes: 'abcdefgh '.repeat(11112) } });
        expect(long.status).toBe(413);
        expect(long.body.message).toBe('Your notes are too long. The limit is 100,000 characters.');
        await noReviewerMade();
    });

    test('a field far over the size limit is 413 too', async () => {
        const { agent } = await signUp();
        const res = await send(agent, { fields: { notes: 'abcdefgh '.repeat(70000) } });
        expect(res.status).toBe(413);
        expect(res.body.message).toBe('Your notes are too long. The limit is 100,000 characters.');
        await slotsFree();
    });

    test('notes with Windows line endings and a NUL are cleaned; the title is "Pasted notes"', async () => {
        const { agent } = await signUp();
        const raw = `${'The mitochondria is the powerhouse of the cell.\r\n'.repeat(100)}Bad\u0000byte.`;
        const res = await send(agent, { fields: { notes: raw } });
        expect(res.status).toBe(201);
        expect(res.body.reviewer.title).toBe('Pasted notes');
        expect(res.body.reviewer.source).toMatchObject({ type: 'notes', fileName: '', count: 1 });
        const stored = await textOf(res.body.reviewer._id);
        expect(stored).not.toMatch(/[\r\u0000]/);
        expect(stored).toContain('Badbyte.');
        expect(stored.length).toBeGreaterThan(4000);

        await settleGenerationJobs();
        expect(generateJson.mock.calls[0][0].prompt).toContain('mitochondria');
    });

    test('notes sent as JSON work too', async () => {
        const { agent } = await signUp();
        const res = await jsonOf(agent, { notes: 'The Krebs cycle runs in the matrix. '.repeat(20), questionCount: 10 });
        expect(res.status).toBe(201);
        expect(res.body.reviewer.source.type).toBe('notes');
    });
});

// --- Study files ---

describe('files picked from My files', () => {
    const pick = (agent, ids, fields = {}) => send(agent, { fields: { fileIds: ids.map(String).join(','), ...fields } });

    test('three of the student\'s files make one reviewer, and the read is budgeted as links', async () => {
        const { agent, user } = await signUp();
        const rows = [await libraryFile(user, pdf(), 'a.pdf'), await libraryFile(user, docx(), 'b.docx'), await libraryFile(user, pptx(), 'c.pptx')];
        const before = await storedProps(user);
        const get = vi.spyOn(store, 'get');

        const res = await pick(agent, rows.map((row) => row._id));
        expect(res.status).toBe(201);
        expect(res.body.reviewer.source).toMatchObject({ type: 'mixed', count: 3 });
        expect(res.body.reviewer.source.items.map((item) => item.fileId)).toEqual(rows.map((row) => String(row._id)));
        expect(get).toHaveBeenCalledTimes(3);

        const after = await storedProps(user);
        expect(after.objects).toBe(before.objects);
        expect(after.storageUsedBytes).toBe(before.storageUsedBytes);
        expect(after.links).toBe(before.links + 3);
        expect(after.classB).toBe(before.classB + 3);
        await settleGenerationJobs();
        expect(JSON.stringify(res.body)).not.toMatch(/storageId|memory:|fingerprint/);
        const stored = await reviewerModel.findById(res.body.reviewer._id);
        expect(String(stored.sources[1].file)).toBe(String(rows[1]._id));
    });

    test('ids that are not the student\'s ready library files are all 404 "File not found." and cost nothing', async () => {
        const { agent, user } = await signUp();
        const other = (await signUp()).user;
        const mine = await libraryFile(user, docx(), 'mine.docx');
        const theirs = await libraryFile(other, docx(), 'theirs.docx');
        const chat = await storeFile({
            ownerId: user._id, scope: 'chat', refs: { group: new mongoose.Types.ObjectId(), message: new mongoose.Types.ObjectId() },
            file: { buffer: docx(), name: 'chat.docx', ext: 'docx', mimeType: 'x' },
        });
        const uploading = await libraryFile(user, docx(), 'half.docx');
        await fileModel.updateOne({ _id: uploading._id }, { state: 'uploading' });
        const deleting = await libraryFile(user, docx(), 'gone.docx');
        await fileModel.updateOne({ _id: deleting._id }, { state: 'removing' });

        const before = await storedProps(user);
        const get = vi.spyOn(store, 'get');
        const bad = [theirs._id, chat._id, uploading._id, deleting._id, new mongoose.Types.ObjectId(), 'not-an-id', 'abcdefghijkl', `${String(mine._id)}zz`];
        for (const id of bad) {
            const res = await pick(agent, [mine._id, id]);
            expect(res.status, String(id)).toBe(404);
            expect(res.body.message, String(id)).toBe('File not found.');
        }
        expect(get).not.toHaveBeenCalled();
        expect(await storedProps(user)).toEqual(before);
        await noReviewerMade();
    });

    // Each filter of the picked-files query is proven on its own. The file in each case would get
    // through the later checks if the filter were missing (a type that is refused by name, or a chat
    // file its member may read), so only the query itself can turn it into the same 404.
    const expectNotFound = async (agent, user, ids) => {
        const get = vi.spyOn(store, 'get');
        const before = await storedProps(user);
        const res = await pick(agent, ids);
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('File not found.');
        expect(get).not.toHaveBeenCalled();
        expect(await storedProps(user)).toEqual(before);
        await noReviewerMade();
    };

    test('owner: a library file of another student is not found, whatever its type', async () => {
        const { agent, user } = await signUp();
        const { user: other } = await signUp();
        const mine = await libraryFile(user, docx(), 'mine.docx');
        const theirs = await libraryFile(other, makeOffice('xlsx'), 'their budget.xlsx');
        await expectNotFound(agent, user, [mine._id, theirs._id]);
    });

    test.each(['uploading', 'removing'])('state: your own library file that is %s is not found, whatever its type', async (state) => {
        const { agent, user } = await signUp();
        const mine = await libraryFile(user, docx(), 'mine.docx');
        const unfinished = await libraryFile(user, makeOffice('xlsx'), 'budget.xlsx');
        await fileModel.updateOne({ _id: unfinished._id }, { state });
        await expectNotFound(agent, user, [mine._id, unfinished._id]);
    });

    test('scope: your own chat file, in a group you belong to, is not found', async () => {
        const { agent, user } = await signUp();
        const { user: friend } = await signUp();
        const group = await groupModel.create({ name: 'Study', admin: user._id, members: [user._id, friend._id] });
        const message = await groupMessageModel.create({ group: group._id, sender: user._id, text: 'notes' });
        const chat = await storeFile({
            ownerId: user._id, scope: 'chat', refs: { group: group._id, message: message._id },
            file: { buffer: docx(), name: 'shared.docx', ext: 'docx', mimeType: 'x' },
        });
        const mine = await libraryFile(user, docx(), 'mine.docx');
        await expectNotFound(agent, user, [mine._id, chat._id]);
    });

    test('more than 10 ids is 400; duplicates are counted once', async () => {
        const { agent, user } = await signUp();
        const row = await libraryFile(user, docx(), 'a.docx');
        const many = Array.from({ length: 11 }, () => new mongoose.Types.ObjectId());
        const res = await pick(agent, many);
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('You can add up to 10 files to one reviewer.');

        const same = await pick(agent, [row._id, row._id, String(row._id).toUpperCase()]);
        expect(same.status).toBe(201);
        expect(same.body.reviewer.source.count).toBe(1);
    });

    test('a file type that can\'t be a source is 400 by name, with no read', async () => {
        const { agent, user } = await signUp();
        const sheet = await libraryFile(user, makeOffice('xlsx'), 'budget.xlsx');
        const good = await libraryFile(user, docx(), 'good.docx');
        const get = vi.spyOn(store, 'get');
        const before = await storedProps(user);
        const res = await pick(agent, [good._id, sheet._id]);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/^budget\.xlsx can't be made into a reviewer/);
        expect(get).not.toHaveBeenCalled();
        expect(await storedProps(user)).toEqual(before);
    });

    test('photos in My files are not read yet, and cost nothing', async () => {
        const { agent, user } = await signUp();
        const photo = await libraryFile(user, makePng(), 'photo.png');
        const get = vi.spyOn(store, 'get');
        const res = await pick(agent, [photo._id]);
        expect(res.status).toBe(422);
        expect(res.body.message).toBe("Photos and scanned PDFs can't be read yet.");
        expect(get).not.toHaveBeenCalled();
    });

    test('files off is 503 files_off, with no read', async () => {
        const { agent, user } = await signUp();
        const row = await libraryFile(user, docx(), 'a.docx');
        useLimits({ availability: { on: false, store: null, reason: 'disabled' } });
        const res = await pick(agent, [row._id]);
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('files_off');
        await noReviewerMade();
    });

    test('the daily limit is 429 before any read', async () => {
        const { agent, user } = await signUp();
        const row = await libraryFile(user, docx(), 'a.docx');
        await aiRequestModel.insertMany(Array.from({ length: DAILY_GENERATION_LIMIT }, () => ({ user: user._id })));
        const get = vi.spyOn(store, 'get');
        const before = await storedProps(user);
        const res = await pick(agent, [row._id]);
        expect(res.status).toBe(429);
        expect(get).not.toHaveBeenCalled();
        expect(await storedProps(user)).toEqual(before);
    });

    test('the daily link limit answers with the file message and reads nothing', async () => {
        useLimits({ linksPerDay: 2 });
        const { agent, user } = await signUp();
        const rows = [await libraryFile(user, docx(), 'a.docx'), await libraryFile(user, docx(), 'b.docx'), await libraryFile(user, docx(), 'c.docx')];
        const get = vi.spyOn(store, 'get');
        const res = await pick(agent, rows.map((row) => row._id));
        expect(res.status).toBe(429);
        expect(res.body.code).toBe('daily_limit');
        expect(get).not.toHaveBeenCalled();
        await noReviewerMade();
    });

    test('picking is limited by the same burst rule as downloading', async () => {
        useLimits({ linkBurst: { limit: 1, windowMs: 60000 } });
        const { agent, user } = await signUp();
        const row = await libraryFile(user, docx(), 'a.docx');
        expect((await pick(agent, [row._id])).status).toBe(201);
        await settleGenerationJobs();
        const get = vi.spyOn(store, 'get');
        const slow = await pick(agent, [row._id], { questionCount: '10' });
        expect(slow.status).toBe(429);
        expect(slow.body.code).toBe('slow_down');
        expect(get).not.toHaveBeenCalled();
    });

    test('a store that fails to read is 502 with a plain message', async () => {
        const { agent, user } = await signUp();
        const row = await libraryFile(user, docx(), 'a.docx');
        store.failNext('get');
        const res = await pick(agent, [row._id]);
        expect(res.status).toBe(502);
        expect(res.body.message).toBe("We couldn't open that file right now. Try again.");
        await noReviewerMade();
        await slotsFree();
    });

    test('bytes that no longer match their record are 502', async () => {
        const { agent, user } = await signUp();
        const row = await libraryFile(user, docx(), 'a.docx');
        const key = row.storageId.replace(/^memory:/, '');
        await store.put(key, Buffer.concat([docx(), Buffer.from('!')]));
        const res = await pick(agent, [row._id]);
        expect(res.status).toBe(502);
        expect(res.body.message).toBe("We couldn't open that file right now. Try again.");
    });

    test('a file whose bytes are another type than its record is "damaged", not trusted', async () => {
        const { agent, user } = await signUp();
        const row = await libraryFile(user, docx(), 'a.docx');
        const swapped = pdf();
        await store.put(row.storageId.replace(/^memory:/, ''), swapped);
        await fileModel.updateOne({ _id: row._id }, { size: swapped.length, sha256: '' });
        const res = await pick(agent, [row._id]);
        expect(res.status).toBe(422);
        expect(res.body.message).toMatch(/^We couldn't read a\.docx/);
    });
});

// --- double submit ---

describe('a double submit', () => {
    // Holds the first reviewer in "processing" so the second request arrives while it is still being made.
    const hold = () => {
        let release;
        generateJson.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ data: aiOutput(), model: 'gemini-test' }); }));
        return async () => {
            await vi.waitFor(() => expect(release).toBeTypeOf('function'));
            release();
            await settleGenerationJobs();
        };
    };

    test('the same upload twice is one reviewer and one AI request', async () => {
        const { agent } = await signUp();
        const finish = hold();
        const first = await send(agent, { files: [[docx(), 'a.docx'], [pptx(), 'b.pptx']] });
        const second = await send(agent, { files: [[docx(), 'renamed.docx'], [pptx(), 'again.pptx']] });
        expect(first.status).toBe(201);
        expect(second.status).toBe(200);
        expect(second.body.reviewer._id).toBe(first.body.reviewer._id);
        await finish();
        expect(await reviewerModel.countDocuments()).toBe(1);
        expect(await aiRequestModel.countDocuments()).toBe(1);
    });

    test('a different file, order or question count is a new reviewer', async () => {
        const { agent } = await signUp();
        const finish = hold();
        const first = await send(agent, { files: [[docx(), 'a.docx'], [pptx(), 'b.pptx']] });
        const swapped = await send(agent, { files: [[pptx(), 'b.pptx'], [docx(), 'a.docx']] });
        const count = await send(agent, { files: [[docx(), 'a.docx'], [pptx(), 'b.pptx']], fields: { questionCount: '20' } });
        expect([first.status, swapped.status, count.status]).toEqual([201, 201, 201]);
        await finish();
    });

    test('the same pick twice is one reviewer and one read set', async () => {
        const { agent, user } = await signUp();
        const rows = [await libraryFile(user, docx(), 'a.docx'), await libraryFile(user, pdf(), 'b.pdf')];
        const get = vi.spyOn(store, 'get');
        const finish = hold();
        const ids = rows.map((row) => String(row._id)).join(',');
        const first = await send(agent, { fields: { fileIds: ids } });
        const before = await storedProps(user);
        const second = await send(agent, { fields: { fileIds: ids } });
        expect(first.status).toBe(201);
        expect(second.status).toBe(200);
        expect(second.body.reviewer._id).toBe(first.body.reviewer._id);
        expect(get).toHaveBeenCalledTimes(2);
        expect(await storedProps(user)).toEqual(before);
        await finish();
        expect(await aiRequestModel.countDocuments()).toBe(1);
    });

    test('the same notes twice is one reviewer', async () => {
        const { agent } = await signUp();
        const notes = 'Osmosis moves water across a membrane. '.repeat(15);
        const finish = hold();
        const first = await send(agent, { fields: { notes } });
        const second = await send(agent, { fields: { notes } });
        expect(second.status).toBe(200);
        expect(second.body.reviewer._id).toBe(first.body.reviewer._id);
        await finish();
        expect(await reviewerModel.countDocuments()).toBe(1);
    });

    test('the second request is answered without reading the files', async () => {
        const { agent } = await signUp();
        const finish = hold();
        extractDocxText.mockClear();
        const first = await send(agent, { files: [[docx(), 'a.docx']] });
        expect(first.status).toBe(201);
        expect(extractDocxText).toHaveBeenCalledTimes(1);
        const second = await send(agent, { files: [[docx(), 'a.docx']] });
        expect(second.status).toBe(200);
        expect(extractDocxText).toHaveBeenCalledTimes(1);
        await finish();
    });
});

// --- slots ---

describe('jobs holding file bytes', () => {
    test('with both slots taken the next request is 503 before anything is read, and works once one frees', async () => {
        const { agent } = await signUp();
        const held = [sourceSlots.take(), sourceSlots.take()];
        const busy = await send(agent, { files: [[docx(), 'a.docx']] });
        expect(busy.status).toBe(503);
        expect(busy.body.message).toBe('Lots of reviewers are being made right now. Try again in a minute.');
        await noReviewerMade();
        expect(sourceSlots.inUse()).toBe(2);

        held[0]();
        expect((await send(agent, { files: [[docx(), 'a.docx']] })).status).toBe(201);
        await vi.waitFor(() => expect(sourceSlots.inUse()).toBe(1));
        held[1]();
        held[1]();
        expect(sourceSlots.inUse()).toBe(0);
    });

    test('a signed-out request gets the sign-in answer, not "busy", and takes no slot', async () => {
        const held = [sourceSlots.take(), sourceSlots.take()];
        const res = await request(app).post('/api/reviewers').attach('files', docx(), { filename: 'a.docx' });
        expect(res.body).toEqual({ success: false, message: 'Unauthorized' });
        expect(sourceSlots.inUse()).toBe(2);
        held.forEach((release) => release());
        expect(sourceSlots.inUse()).toBe(0);
        await noReviewerMade();
    });

    test('every way a request can end gives its slot back exactly once', async () => {
        const { agent } = await signUp();
        const notes = 'Osmosis moves water across a membrane. '.repeat(15);
        const requests = [
            () => send(agent, { files: [[docx(), 'a.docx']] }),
            () => send(agent, { files: [[docx(), 'a.docx']] }),
            () => send(agent, { files: [[makeOffice('xlsx'), 'a.xlsx']] }),
            () => send(agent, { fields: { notes: 'short' } }),
            () => send(agent, { fields: { notes, questionCount: '7' } }),
            () => send(agent, { fields: { notes: 'abcdefgh '.repeat(70000) } }),
            () => agent.post('/api/reviewers').field('fileIds', 'a'.repeat(24)).field('fileIds', 'b'.repeat(24)),
            () => jsonOf(agent, {}),
        ];
        for (const run of requests) {
            await run();
            await slotsFree();
        }
        // If a slot had leaked, these two would run out of room.
        expect((await send(agent, { fields: { notes: `${notes}1` } })).status).toBe(201);
        expect((await send(agent, { fields: { notes: `${notes}2` } })).status).toBe(201);
        await slotsFree();
    });
});

// --- reading the result back ---

describe('what comes back', () => {
    test('regenerate and targeted still work after a picked file is deleted from My files', async () => {
        const { agent, user } = await signUp();
        const row = await libraryFile(user, docx(), 'a.docx');
        const created = await send(agent, { fields: { fileIds: String(row._id) } });
        expect(created.status).toBe(201);
        await settleGenerationJobs();
        const id = created.body.reviewer._id;

        await removeFiles({ _id: row._id });
        expect(await fileModel.countDocuments({ _id: row._id })).toBe(0);

        const regenerated = await agent.post(`/api/reviewers/${id}/regenerate`).send({});
        expect(regenerated.status).toBe(200);
        await settleGenerationJobs();
        expect((await agent.get(`/api/reviewers/${id}/status`)).body.status).toBe('ready');

        generateJson.mockResolvedValueOnce({
            data: {
                questions: Array.from({ length: 5 }, (_, i) => ({
                    topic: 'Respiration', prompt: `New question ${i + 1}?`, options: ['Right', 'Wrong one', 'Wrong two', 'Wrong three'], correctIndex: 0, explanation: 'Because.', difficulty: 'easy',
                })),
            },
            model: 'gemini-test',
        });
        const targeted = await agent.post(`/api/reviewers/${id}/targeted`).send({ topics: ['Respiration'], questionCount: 5 });
        expect(targeted.status).toBe(202);
        await settleGenerationJobs();
        expect((await agent.get(`/api/reviewers/${id}/status`)).body.targeted.status).toBe('ready');
    });

    test('with no stored text, regenerate and targeted say to add the files again', async () => {
        const { agent, user } = await signUp();
        const failed = await reviewerModel.create({ owner: user._id, title: 'Empty', status: 'failed', questionTarget: 10 });
        const ready = await reviewerModel.create({
            owner: user._id, title: 'Ready', status: 'ready', version: 1, questionTarget: 10, topics: [{ name: 'A', summary: '' }],
        });
        const regenerate = await agent.post(`/api/reviewers/${failed._id}/regenerate`).send({});
        expect(regenerate.status).toBe(409);
        expect(regenerate.body.message).toBe('Add the files again to make new questions.');
        const targeted = await agent.post(`/api/reviewers/${ready._id}/targeted`).send({ topics: ['A'], questionCount: 5 });
        expect(targeted.status).toBe(409);
        expect(targeted.body.message).toBe('Add the files again to make new questions.');
    });

    test('a reviewer made before several sources existed lists and opens as one PDF', async () => {
        const { agent, user } = await signUp();
        const { insertedId } = await reviewerModel.collection.insertOne({
            owner: user._id,
            title: 'Old one',
            course: '',
            status: 'ready',
            version: 1,
            source: { fileName: 'Old notes.pdf', pages: 4, chars: 5000, truncated: false },
            sourceText: 'Old text. '.repeat(100),
            questionTarget: 15,
            summary: '',
            keyPoints: [],
            keyTerms: [],
            topics: [],
            questions: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        const expected = {
            type: 'pdf', fileName: 'Old notes.pdf', count: 1, pages: 4, slides: 0, chars: 5000, truncated: false,
            items: [{ type: 'pdf', fileName: 'Old notes.pdf', pages: 4, slides: 0, chars: 5000, truncated: false, skipped: false, fileId: null }],
        };
        const list = await agent.get('/api/reviewers');
        expect(list.body.reviewers.find((r) => r._id === String(insertedId)).source).toEqual(expected);
        const opened = await agent.get(`/api/reviewers/${insertedId}`);
        expect(opened.body.reviewer.source).toEqual(expected);
        expect(JSON.stringify([list.body, opened.body])).not.toMatch(/fingerprint/);
    });

    test('the list and the status carry the new fields and never the fingerprint', async () => {
        const { agent } = await signUp();
        const res = await send(agent, { files: [[docx(), 'a.docx'], [pptx(), 'b.pptx']] });
        await settleGenerationJobs();
        const list = await agent.get('/api/reviewers');
        expect(list.body.reviewers[0].source).toMatchObject({ type: 'mixed', count: 2 });
        expect(list.body.reviewers[0].source.items).toHaveLength(2);
        expect(JSON.stringify(list.body)).not.toMatch(/fingerprint|storageId/);
        const status = await agent.get(`/api/reviewers/${res.body.reviewer._id}/status`);
        expect(status.body).toMatchObject({ status: 'ready', note: '', progress: { stage: '', done: 0, total: 0 } });
        expect(JSON.stringify(status.body)).not.toMatch(/fingerprint/);
    });

    test('nobody else can open a source-made reviewer', async () => {
        const { agent } = await signUp();
        const { agent: other } = await signUp();
        const res = await send(agent, { files: [[docx(), 'a.docx']] });
        expect((await other.get(`/api/reviewers/${res.body.reviewer._id}`)).status).toBe(404);
    });
});
