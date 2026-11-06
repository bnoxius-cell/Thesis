// Decides what an uploaded file really is from its bytes, never from the type or name the browser sent.
// Anything not on the allowlist (SVG, HTML, GIF, archives, programs, macro-enabled Office files) is refused.
// Pure: a buffer and a claimed name in, a type description or null out.

import { extensionOf } from './fileNames.js';

const type = (ext, mimeType, isImage = false) => Object.freeze({ ext, mimeType, isImage });

const PNG = type('png', 'image/png', true);
const JPEG = type('jpg', 'image/jpeg', true);
const WEBP = type('webp', 'image/webp', true);
const PDF = type('pdf', 'application/pdf');
const TEXT = type('txt', 'text/plain');
const MARKDOWN = type('md', 'text/markdown');

// Office files are ZIPs: the claimed extension picks the type, and the folder proves it.
const OFFICE = {
    docx: { type: type('docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), folder: 'word/' },
    pptx: { type: type('pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'), folder: 'ppt/' },
    xlsx: { type: type('xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), folder: 'xl/' },
};
const TEXT_EXTENSIONS = { txt: TEXT, md: MARKDOWN, markdown: MARKDOWN };

const CONTENT_TYPES_ENTRY = '[Content_Types].xml';
const MACRO_ENTRY = /(?:^|\/)vbaProject\.bin$|\/macrosheets\//i;
const MAX_ZIP_ENTRIES = 10_000;

const ZIP_LOCAL_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const EOCD_SIGNATURE = 0x06054b50;
const EOCD_SIZE = 22;
const MAX_ZIP_COMMENT = 0xffff;
const CENTRAL_SIGNATURE = 0x02014b50;
const CENTRAL_HEADER_SIZE = 46;

const startsWith = (buf, bytes) => buf.length >= bytes.length && bytes.every((byte, i) => buf[i] === byte);

const binaryType = (buf) => {
    if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return PNG;
    if (startsWith(buf, [0xff, 0xd8, 0xff])) return JPEG;
    if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return WEBP;
    if (buf.toString('latin1', 0, 5) === '%PDF-') return PDF;
    return null;
};

// The end-of-central-directory record, found by scanning back from the end. Only a record whose comment
// runs exactly to the end of the file counts, so a fake one planted inside a comment is skipped.
const findEndRecord = (buf) => {
    const earliest = Math.max(0, buf.length - EOCD_SIZE - MAX_ZIP_COMMENT);
    for (let pos = buf.length - EOCD_SIZE; pos >= earliest; pos--) {
        if (buf.readUInt32LE(pos) === EOCD_SIGNATURE && pos + EOCD_SIZE + buf.readUInt16LE(pos + 20) === buf.length) return pos;
    }
    return -1;
};

// Entry names from the central directory, or null when the structure is not a plain single-disk ZIP.
// Reads headers only, never entry data, and stops at MAX_ZIP_ENTRIES.
const zipEntryNames = (buf) => {
    const eocd = findEndRecord(buf);
    if (eocd < 0) return null;
    const diskNumber = buf.readUInt16LE(eocd + 4);
    const centralDisk = buf.readUInt16LE(eocd + 6);
    const entriesOnDisk = buf.readUInt16LE(eocd + 8);
    const count = buf.readUInt16LE(eocd + 10);
    const size = buf.readUInt32LE(eocd + 12);
    const offset = buf.readUInt32LE(eocd + 16);
    const isZip64 = count === 0xffff || size === 0xffffffff || offset === 0xffffffff;
    if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== count || isZip64) return null;
    if (count === 0 || count > MAX_ZIP_ENTRIES || offset + size > eocd) return null;

    const end = offset + size;
    const names = [];
    let pos = offset;
    for (let i = 0; i < count; i++) {
        if (pos + CENTRAL_HEADER_SIZE > end || buf.readUInt32LE(pos) !== CENTRAL_SIGNATURE) return null;
        const nameLength = buf.readUInt16LE(pos + 28);
        const next = pos + CENTRAL_HEADER_SIZE + nameLength + buf.readUInt16LE(pos + 30) + buf.readUInt16LE(pos + 32);
        if (next > end) return null;
        names.push(buf.toString('latin1', pos + CENTRAL_HEADER_SIZE, pos + CENTRAL_HEADER_SIZE + nameLength));
        pos = next;
    }
    return names;
};

const officeType = (buf, claimedExt) => {
    const office = OFFICE[claimedExt];
    if (!office || !startsWith(buf, ZIP_LOCAL_HEADER)) return null;
    const names = zipEntryNames(buf);
    if (!names || !names.includes(CONTENT_TYPES_ENTRY)) return null;
    if (!names.some((name) => name.startsWith(office.folder))) return null;
    if (names.some((name) => MACRO_ENTRY.test(name))) return null;
    return office.type;
};

// Text is only accepted when the name says txt or md, so markup named .png or .pdf is not waved through.
const textType = (buf, claimedExt) => {
    const found = TEXT_EXTENSIONS[claimedExt];
    if (!found || buf.includes(0)) return null;
    try {
        new TextDecoder('utf-8', { fatal: true }).decode(buf); // a leading BOM is skipped
        return found;
    } catch {
        return null;
    }
};

// { ext, mimeType, isImage } for an allowed file, otherwise null. The ext is the one to store, whatever the name said.
export const detectFileType = (buffer, fileName = '') => {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
    const claimedExt = extensionOf(fileName);
    return binaryType(buffer) ?? (startsWith(buffer, ZIP_LOCAL_HEADER) ? officeType(buffer, claimedExt) : textType(buffer, claimedExt));
};
