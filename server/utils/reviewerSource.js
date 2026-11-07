// What a reviewer can be made from (plan 21): the caps, the checks on a file's real type, turning each
// file into text, sharing the text budget between several files, and the few student messages that go
// with a refusal. No database and no request objects here, so it is easy to test. The one thing
// that touches a response is sendSourceError.
import { createHash } from 'node:crypto';
import { extractPdfText, cleanPageText, MAX_SOURCE_CHARS, MIN_SOURCE_CHARS } from './pdfText.js';
import { extractDocxText, extractPptxText, MAX_DOCX_XML_BYTES, MAX_PPTX_TOTAL_BYTES } from './officeText.js';
import { ZipError } from './zipEntries.js';
import { detectFileType } from './fileTypes.js';
import { imageInfo } from './imageInfo.js';
import { extensionOf } from './fileNames.js';

const MB = 1024 * 1024;
export const MAX_SOURCES = 10;
export const MAX_SOURCE_BYTES = 10 * MB;
export const MAX_SOURCES_BYTES = 20 * MB;
// The multipart framing and the small text fields on top of the files.
export const BODY_OVERHEAD_BYTES = 1 * MB;
export const MAX_NOTES_CHARS = 100000;
// Word and PowerPoint XML unpacked for one reviewer, all its files together. Unpacking runs on the
// event loop, so a small, very compressible file must not make it unpack hundreds of MB.
export const MAX_UNPACKED_BYTES = 60 * MB;
// Reviewer jobs holding file bytes at once, server-wide. One student holds at most one of them.
export const MAX_SOURCE_SLOTS = 2;
// How long the whole upload may take to arrive. 120 s fits the 21 MB cap on a 1.5 Mbps connection;
// a body trickled in slower would hold a slot for nothing. Tests shorten it.
export const sourceSettings = { bodyReadMs: 120 * 1000 };
// A scanned PDF up to this many pages is read as pictures; longer ones need a text layer.
export const MAX_SCAN_PAGES = 15;
// Pictures read in one reviewer: a photo is one, a scanned PDF is one per page.
export const MAX_PICTURES = 15;

// What a file can be, by the type its bytes show (never its name). Each maps to the label stored on
// the reviewer.
const SOURCE_KINDS = Object.freeze({ pdf: 'pdf', docx: 'docx', pptx: 'pptx', png: 'image', jpg: 'image', webp: 'image' });
export const REVIEWER_SOURCE_TYPES = Object.freeze(Object.keys(SOURCE_KINDS));
// 'pdf' | 'docx' | 'pptx' | 'image' for a detected file extension, null for anything else.
export const sourceKindOf = (ext) => SOURCE_KINDS[ext] ?? null;

// What Gemini is told each picture is. A scanned PDF is sent whole, as a PDF.
const PICTURE_MIME_TYPES = Object.freeze({ png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf' });

const OLE_HEADER = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
// Names that would be Word or PowerPoint files, old or new. A password-protected one is an OLE file too.
const WORD_OR_POWERPOINT = new Set(['doc', 'docx', 'ppt', 'pptx']);

// ---------------------------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------------------------

const TOO_LITTLE_TEXT = {
    pdf: () => "This PDF doesn't have enough text to make a reviewer.",
    docx: () => "This Word file doesn't have enough text to make a reviewer.",
    pptx: () => "These slides don't have enough text to make a reviewer. If they're mostly pictures, add photos of them instead.",
    several: () => "These files don't have enough text to make a reviewer.",
};

// code -> [status, message(name)]. The wording is the student-facing table in plan 21, 3.9.
const REFUSALS = {
    no_source: [400, () => 'Add a file or paste your notes to make a reviewer.'],
    many_kinds: [400, () => 'Pick one source: upload files, choose from your study files, or paste notes.'],
    too_many_files: [400, () => `You can add up to ${MAX_SOURCES} files to one reviewer.`],
    bad_upload: [400, () => "The upload didn't go through. Try again."],
    no_length: [411, () => "The upload didn't go through. Try again."],
    slow_upload: [408, () => 'The upload took too long. Try again with fewer or smaller files, or on a faster connection.'],
    bad_type: [400, (name) => `${name} can't be made into a reviewer. Use PDF, Word or PowerPoint files, or photos (PNG, JPG or WebP).`],
    file_too_big: [413, (name) => (name
        ? `${name} is too big. Each file can be up to ${MAX_SOURCE_BYTES / MB} MB.`
        : `One of the files is too big. Each file can be up to ${MAX_SOURCE_BYTES / MB} MB.`)],
    too_big_together: [413, () => `Those files are too big together. The limit is ${MAX_SOURCES_BYTES / MB} MB for one reviewer.`],
    cannot_open: [422, (name) => `We can't open ${name}. If it has a password, remove it. If it's an old .doc or .ppt file, save it as .docx or .pptx first.`],
    pdf_password: [422, (name) => `${name} is password protected. Remove the password and add it again.`],
    damaged: [422, (name) => `We couldn't read ${name}. It may be damaged. Try saving it again, or as a PDF.`],
    too_big_inside: [422, (name) => `${name} is too big inside for us to read. Try saving it as a PDF, or split it.`],
    too_big_inside_together: [422, () => 'These Word and PowerPoint files are too much for us to read together. Use fewer of them in one reviewer, or save some as PDFs.'],
    scanned_long: [422, (name) => `${name} looks scanned and has more than ${MAX_SCAN_PAGES} pages. Split it into parts of ${MAX_SCAN_PAGES} pages or fewer.`],
    too_many_pictures: [422, () => `That's a lot to read. Use up to ${MAX_PICTURES} photos or scanned pages in one reviewer.`],
    too_little_pdf: [422, TOO_LITTLE_TEXT.pdf],
    too_little_docx: [422, TOO_LITTLE_TEXT.docx],
    too_little_pptx: [422, TOO_LITTLE_TEXT.pptx],
    too_little_several: [422, TOO_LITTLE_TEXT.several],
    notes_short: [400, () => `Add a bit more. Notes need at least ${MIN_SOURCE_CHARS} characters.`],
    notes_long: [413, () => `Your notes are too long. The limit is ${MAX_NOTES_CHARS.toLocaleString('en-US')} characters.`],
    not_found: [404, () => 'File not found.'],
    stored_unreadable: [502, () => "We couldn't open that file right now. Try again."],
    busy: [503, () => 'Lots of reviewers are being made right now. Try again in a minute.'],
    busy_you: [503, () => "You're already making a reviewer from files. Try again once it has finished reading them."],
};

// A request we turn down, with the status and message the student sees. `name` is a file name.
export class SourceError extends Error {
    constructor(code, name = '') {
        const [status, message] = REFUSALS[code];
        super(message(name));
        this.name = 'SourceError';
        this.code = code;
        this.status = status;
    }
}

export const sendSourceError = (res, error) => res.status(error.status).json({ success: false, message: error.message });

// A file name that is safe to show in a message and keep on a reviewer: no control, invisible or
// bidi characters, one line, not too long.
export const displayName = (name) => String(name ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '')
    .trim()
    .slice(0, 120) || 'file';

// ---------------------------------------------------------------------------------------------
// Concurrent jobs
// ---------------------------------------------------------------------------------------------

// Only a couple of requests may hold file bytes at once, so the small server keeps its memory, and one
// student holds at most one of them, so nobody can take them all. take(owner) hands back a release
// function, or null when none is free or the owner already holds one (holds(owner) tells which).
// Releasing twice is harmless.
const createSlots = (limit) => {
    const owners = new Set();
    return {
        holds: (owner) => owners.has(String(owner)),
        take(owner) {
            const key = String(owner);
            if (owners.size >= limit || owners.has(key)) return null;
            owners.add(key);
            let released = false;
            return () => {
                if (released) return;
                released = true;
                owners.delete(key);
            };
        },
        inUse: () => owners.size,
    };
};
export const sourceSlots = createSlots(MAX_SOURCE_SLOTS);

// ---------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------

// What a file is, from its bytes: { ext, kind } with kind 'pdf' | 'docx' | 'pptx' | 'image'. Throws a
// SourceError naming the file when it can't be a source.
export const sourceTypeOf = (buffer, name) => {
    const shown = displayName(name);
    const detected = detectFileType(buffer, name);
    if (!detected) {
        const isOle = buffer.length >= OLE_HEADER.length && buffer.subarray(0, OLE_HEADER.length).equals(OLE_HEADER);
        throw new SourceError(isOle && WORD_OR_POWERPOINT.has(extensionOf(name)) ? 'cannot_open' : 'bad_type', shown);
    }
    const kind = sourceKindOf(detected.ext);
    if (!kind) throw new SourceError('bad_type', shown);
    if (detected.isImage && !imageInfo(buffer)) throw new SourceError('bad_type', shown);
    return { ext: detected.ext, kind };
};

// ---------------------------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------------------------

// A PDF with hardly any text for its pages is a scan or a set of pictures.
export const isScannedPdf = (chars, pages) => chars < Math.max(MIN_SOURCE_CHARS, 40 * pages);

const OFFICE_CAPS = { docx: MAX_DOCX_XML_BYTES, pptx: MAX_PPTX_TOTAL_BYTES };

// `unpackedLeft` is what the reviewer's other files left of MAX_UNPACKED_BYTES. When that, not the
// file's own cap, is what ran out, the message is about the files together.
const officeText = (kind, buffer, name, unpackedLeft) => {
    const extract = kind === 'docx' ? extractDocxText : extractPptxText;
    try {
        return extract(buffer, { maxBytes: unpackedLeft });
    } catch (error) {
        if (!(error instanceof ZipError)) throw error;
        if (error.code !== 'too_big') throw new SourceError('damaged', name);
        throw new SourceError(unpackedLeft < OFFICE_CAPS[kind] ? 'too_big_inside_together' : 'too_big_inside', name);
    }
};

const pdfText = async (buffer, name) => {
    let extracted;
    try {
        extracted = await extractPdfText(buffer);
    } catch (error) {
        throw new SourceError(error?.name === 'PasswordException' ? 'pdf_password' : 'damaged', name);
    }
    if (!isScannedPdf(extracted.chars, extracted.pages)) return extracted;
    // A scan short enough is read as pictures; a longer one has to have a text layer.
    if (extracted.pages <= MAX_SCAN_PAGES) return { ...extracted, scanned: true };
    if (extracted.chars < MIN_SOURCE_CHARS) throw new SourceError('scanned_long', name);
    return extracted;
};

// { text, pages, slides, chars, truncated } for a PDF, Word or PowerPoint file of that `kind`, plus
// `scanned: true` for a PDF that has to be read as pictures and `unpacked` (bytes) for Word and
// PowerPoint, which may unpack at most `unpackedLeft`. Throws a SourceError naming the file when it
// can't be read.
export const readSourceText = async (kind, buffer, name, { unpackedLeft = MAX_UNPACKED_BYTES } = {}) => {
    const shown = displayName(name);
    return kind === 'pdf' ? pdfText(buffer, shown) : officeText(kind, buffer, shown, unpackedLeft);
};

const NO_TEXT = Object.freeze({ text: '', pages: 0, slides: 0, chars: 0, truncated: false });

// How many pictures a source adds up to.
const picturesIn = (source) => (source.picture ? Math.max(1, source.pages) : 0);

// The text of each file, one at a time, in the order given. `items` is [{ buffer, name, kind, ext, bytes,
// file }] and is emptied as it goes, so a file's bytes can be freed as soon as its text is out. A photo or
// a scanned PDF has no text yet: it keeps its bytes as `picture`, to be read by Gemini (reviewerPictures.js).
export const readSources = async (items) => {
    const sources = [];
    let pictures = 0;
    let unpackedLeft = MAX_UNPACKED_BYTES;
    while (items.length) {
        const { buffer, name, kind, ext, bytes, file } = items.shift();
        const { unpacked = 0, ...extracted } = kind === 'image' ? NO_TEXT : await readSourceText(kind, buffer, name, { unpackedLeft });
        unpackedLeft -= unpacked;
        const isPicture = kind === 'image' || Boolean(extracted.scanned);
        const source = {
            ...extracted,
            kind,
            fileName: name,
            bytes,
            file,
            read: isPicture ? 'picture' : 'text',
            picture: isPicture ? { mimeType: PICTURE_MIME_TYPES[ext], data: buffer } : null,
        };
        pictures += picturesIn(source);
        if (pictures > MAX_PICTURES) throw new SourceError('too_many_pictures');
        sources.push(source);
    }
    return sources;
};

// Pasted notes, cleaned: line endings made plain, control characters removed (a NUL or an escape
// code has no business in study notes), page-number lines and extra blank lines dropped. Too short or
// too long is refused rather than cut.
export const cleanNotes = (value) => {
    if (typeof value !== 'string') throw new SourceError('bad_upload');
    const text = cleanPageText(value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ''));
    if (text.length < MIN_SOURCE_CHARS) throw new SourceError('notes_short');
    if (text.length > MAX_NOTES_CHARS) throw new SourceError('notes_long');
    return text;
};

// ---------------------------------------------------------------------------------------------
// Several sources, one text
// ---------------------------------------------------------------------------------------------

// How much of each text to keep when the total is over `budget`: every source gets at least an equal
// share, and what a short one leaves over goes to the long ones. Same order in and out.
export const fitSources = (lengths, budget = MAX_SOURCE_CHARS) => {
    if (lengths.reduce((sum, length) => sum + length, 0) <= budget) return [...lengths];
    const kept = new Array(lengths.length);
    let left = budget;
    const byLength = lengths.map((length, index) => ({ length, index })).sort((a, b) => a.length - b.length);
    byLength.forEach(({ length, index }, position) => {
        kept[index] = Math.min(length, Math.floor(left / (byLength.length - position)));
        left -= kept[index];
    });
    return kept;
};

const SEPARATOR = '\n\n';
const headerOf = (position, name) => `Source ${position + 1}: ${name}\n`;

const itemOf = (source) => ({
    type: source.kind,
    fileName: source.fileName,
    pages: source.pages ?? 0,
    slides: source.slides ?? 0,
    chars: source.chars,
    truncated: source.truncated,
    bytes: source.bytes,
    file: source.file ?? null,
    read: source.read ?? 'text',
    skipped: false,
});

// `sources`: [{ kind, fileName, text, pages, slides, chars, truncated, bytes, file, read, skipped }] in the
// order the student chose, text already cleaned. A `skipped` source (a picture we couldn't read) is listed
// but adds no text. Returns the one text everything downstream works from and the details to store:
// `summary` for the list and `items` per source. With two or more sources that add text, each block starts
// with a "Source N: name" line.
export const combineSources = (sources, fingerprint) => {
    const used = sources.filter((source) => !source.skipped);
    const labelled = used.length > 1;
    const headers = used.map((source, i) => (labelled ? headerOf(i, source.fileName) : ''));
    const room = MAX_SOURCE_CHARS - SEPARATOR.length * Math.max(0, used.length - 1);
    const kept = fitSources(used.map((source, i) => headers[i].length + source.text.length), room);
    const bodyRoom = used.map((source, i) => Math.max(0, kept[i] - headers[i].length));
    const bodies = used.map((source, i) => source.text.slice(0, bodyRoom[i]).trimEnd());

    let next = 0;
    const items = sources.map((source) => {
        if (source.skipped) return { ...itemOf(source), chars: 0, truncated: false, skipped: true };
        const cut = bodyRoom[next] < source.text.length;
        next += 1;
        return { ...itemOf(source), truncated: source.truncated || cut };
    });
    const text = used.map((source, i) => headers[i] + bodies[i]).join(SEPARATOR);

    const kinds = new Set(items.map((item) => item.type));
    const sum = (field) => items.reduce((total, item) => total + item[field], 0);
    return {
        text,
        items,
        summary: {
            type: kinds.size === 1 ? items[0].type : 'mixed',
            fileName: items[0].fileName,
            count: items.length,
            pages: sum('pages'),
            slides: sum('slides'),
            chars: sum('chars'),
            truncated: items.some((item) => item.truncated),
            bytes: sum('bytes'),
            fingerprint,
        },
        bodyChars: bodies.reduce((total, body) => total + body.length, 0),
    };
};

// Which "not enough text" message fits: one for a single PDF, Word or PowerPoint file, one for several.
export const tooLittleTextError = (items) => {
    const single = items.length === 1 && `too_little_${items[0].type}`;
    return new SourceError(single in REFUSALS ? single : 'too_little_several');
};

// ---------------------------------------------------------------------------------------------
// Double submit
// ---------------------------------------------------------------------------------------------

export const hashBytes = (data) => createHash('sha256').update(data).digest('hex');

// The same request sent twice gives the same fingerprint: the kind and, in order, what was sent (each
// file's hash, the picked file ids, or the notes' hash).
export const sourceFingerprint = (kind, parts) => hashBytes(`${kind}\n${parts.join('\n')}`);
