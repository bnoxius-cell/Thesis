// What a reviewer can be made from (plan 21): the caps, the checks on a file's real type, turning each
// file into text, sharing the text budget between several files, and the few student messages that go
// with a refusal. No database and no request objects here, so it is easy to test. The one thing
// that touches a response is sendSourceError.
import { createHash } from 'node:crypto';
import { extractPdfText, cleanPageText, MAX_SOURCE_CHARS, MIN_SOURCE_CHARS } from './pdfText.js';
import { extractDocxText, extractPptxText } from './officeText.js';
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
// Reviewer jobs holding file bytes at once, server-wide.
export const MAX_SOURCE_SLOTS = 2;
// A scanned PDF up to this many pages is read as pictures; longer ones need a text layer.
export const MAX_SCAN_PAGES = 15;

// What a file can be, by the type its bytes show (never its name). Each maps to the label stored on
// the reviewer.
const SOURCE_KINDS = Object.freeze({ pdf: 'pdf', docx: 'docx', pptx: 'pptx', png: 'image', jpg: 'image', webp: 'image' });
export const REVIEWER_SOURCE_TYPES = Object.freeze(Object.keys(SOURCE_KINDS));
// 'pdf' | 'docx' | 'pptx' | 'image' for a detected file extension, null for anything else.
export const sourceKindOf = (ext) => SOURCE_KINDS[ext] ?? null;

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
    bad_type: [400, (name) => `${name} can't be made into a reviewer. Use PDF, Word or PowerPoint files, or photos (PNG, JPG or WebP).`],
    file_too_big: [413, (name) => (name
        ? `${name} is too big. Each file can be up to ${MAX_SOURCE_BYTES / MB} MB.`
        : `One of the files is too big. Each file can be up to ${MAX_SOURCE_BYTES / MB} MB.`)],
    too_big_together: [413, () => `Those files are too big together. The limit is ${MAX_SOURCES_BYTES / MB} MB for one reviewer.`],
    cannot_open: [422, (name) => `We can't open ${name}. If it has a password, remove it. If it's an old .doc or .ppt file, save it as .docx or .pptx first.`],
    pdf_password: [422, (name) => `${name} is password protected. Remove the password and add it again.`],
    damaged: [422, (name) => `We couldn't read ${name}. It may be damaged. Try saving it again, or as a PDF.`],
    too_big_inside: [422, (name) => `${name} is too big inside for us to read. Try saving it as a PDF, or split it.`],
    scanned_long: [422, (name) => `${name} looks scanned and has more than ${MAX_SCAN_PAGES} pages. Split it into parts of ${MAX_SCAN_PAGES} pages or fewer.`],
    // Temporary: removed when photos and scanned PDFs are read (plan 21, R3b).
    pictures_later: [422, () => "Photos and scanned PDFs can't be read yet."],
    too_little_pdf: [422, TOO_LITTLE_TEXT.pdf],
    too_little_docx: [422, TOO_LITTLE_TEXT.docx],
    too_little_pptx: [422, TOO_LITTLE_TEXT.pptx],
    too_little_several: [422, TOO_LITTLE_TEXT.several],
    notes_short: [400, () => `Add a bit more. Notes need at least ${MIN_SOURCE_CHARS} characters.`],
    notes_long: [413, () => `Your notes are too long. The limit is ${MAX_NOTES_CHARS.toLocaleString('en-US')} characters.`],
    not_found: [404, () => 'File not found.'],
    stored_unreadable: [502, () => "We couldn't open that file right now. Try again."],
    busy: [503, () => 'Lots of reviewers are being made right now. Try again in a minute.'],
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

// Only a couple of requests may hold file bytes at once, so the small server keeps its memory.
// take() hands back a release function, or null when none is free. Releasing twice is harmless.
const createSlots = (limit) => {
    let held = 0;
    return {
        take() {
            if (held >= limit) return null;
            held += 1;
            let released = false;
            return () => {
                if (released) return;
                released = true;
                held -= 1;
            };
        },
        inUse: () => held,
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

const officeText = (kind, buffer, name) => {
    try {
        return kind === 'docx' ? extractDocxText(buffer) : extractPptxText(buffer);
    } catch (error) {
        if (!(error instanceof ZipError)) throw error;
        throw new SourceError(error.code === 'too_big' ? 'too_big_inside' : 'damaged', name);
    }
};

const pdfText = async (buffer, name) => {
    let extracted;
    try {
        extracted = await extractPdfText(buffer);
    } catch (error) {
        throw new SourceError(error?.name === 'PasswordException' ? 'pdf_password' : 'damaged', name);
    }
    if (isScannedPdf(extracted.chars, extracted.pages)) {
        // A scan that is short enough will be read as pictures (plan 21, R3b); until then it is refused.
        if (extracted.pages <= MAX_SCAN_PAGES) throw new SourceError('pictures_later');
        if (extracted.chars < MIN_SOURCE_CHARS) throw new SourceError('scanned_long', name);
    }
    return extracted;
};

// { text, pages, slides, chars, truncated } for a PDF, Word or PowerPoint file of that `kind`.
// Throws a SourceError naming the file when it can't be read.
export const readSourceText = async (kind, buffer, name) => {
    const shown = displayName(name);
    return kind === 'pdf' ? pdfText(buffer, shown) : officeText(kind, buffer, shown);
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

// `sources`: [{ kind, fileName, text, pages, slides, chars, truncated, bytes, file }] in the order the
// student chose, text already cleaned. Returns the one text everything downstream works from and the
// details to store: `summary` for the list and `items` per source. With two or more sources each
// block starts with a "Source N: name" line.
export const combineSources = (sources, fingerprint) => {
    const labelled = sources.length > 1;
    const headers = sources.map((source, i) => (labelled ? headerOf(i, source.fileName) : ''));
    const room = MAX_SOURCE_CHARS - SEPARATOR.length * (sources.length - 1);
    const kept = fitSources(sources.map((source, i) => headers[i].length + source.text.length), room);

    const items = sources.map((source, i) => {
        const bodyLength = Math.max(0, kept[i] - headers[i].length);
        return {
            type: source.kind,
            fileName: source.fileName,
            pages: source.pages ?? 0,
            slides: source.slides ?? 0,
            chars: source.chars,
            truncated: source.truncated || bodyLength < source.text.length,
            bytes: source.bytes,
            file: source.file ?? null,
            read: 'text',
            skipped: false,
            body: source.text.slice(0, bodyLength).trimEnd(),
        };
    });
    const text = items.map((item, i) => headers[i] + item.body).join(SEPARATOR);

    const kinds = new Set(items.map((item) => item.type));
    const sum = (field) => items.reduce((total, item) => total + item[field], 0);
    return {
        text,
        items: items.map(({ body, ...item }) => item),
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
        bodyChars: items.reduce((total, item) => total + item.body.length, 0),
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
