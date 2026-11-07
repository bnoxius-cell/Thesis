// A small, strict ZIP reader for Office files: the central directory, then one entry at a time.
// Only plain single-disk ZIPs with stored or deflated entries are read. Every offset is checked
// against the file before it is used, and inflating stops at a byte cap, so a crafted file can't
// make the server read outside the buffer or unpack a "zip bomb" into memory.

import zlib from 'node:zlib';

const MAX_ZIP_ENTRIES = 10_000;

const EOCD_SIGNATURE = 0x06054b50;
const EOCD_SIZE = 22;
const MAX_ZIP_COMMENT = 0xffff;
const CENTRAL_SIGNATURE = 0x02014b50;
const CENTRAL_HEADER_SIZE = 46;
const LOCAL_SIGNATURE = 0x04034b50;
const LOCAL_HEADER_SIZE = 30;

const ENCRYPTED_FLAG = 0x0001;
const STORED = 0;
const DEFLATED = 8;

// code: 'damaged' (broken or unsupported structure), 'encrypted' (password-protected entry) or
// 'too_big' (unpacks past the caller's cap).
export class ZipError extends Error {
    constructor(code, options) {
        super(`ZIP entry ${code}`, options);
        this.name = 'ZipError';
        this.code = code;
    }
}

// The end-of-central-directory record, found by scanning back from the end. Only a record whose comment
// runs exactly to the end of the file counts, so a fake one planted inside a comment is skipped.
const findEndRecord = (buf) => {
    const earliest = Math.max(0, buf.length - EOCD_SIZE - MAX_ZIP_COMMENT);
    for (let pos = buf.length - EOCD_SIZE; pos >= earliest; pos--) {
        if (buf.readUInt32LE(pos) === EOCD_SIGNATURE && pos + EOCD_SIZE + buf.readUInt16LE(pos + 20) === buf.length) return pos;
    }
    return -1;
};

// The entries listed in the central directory, or null when the structure is not a plain single-disk ZIP.
// Reads headers only, never entry data, and stops at MAX_ZIP_ENTRIES. Each entry carries the directory's
// own offset so readZipEntry can tell when an entry's data would run into it.
export const listZipEntries = (buf) => {
    const eocd = findEndRecord(buf);
    if (eocd < 0) return null;
    const diskNumber = buf.readUInt16LE(eocd + 4);
    const centralDisk = buf.readUInt16LE(eocd + 6);
    const entriesOnDisk = buf.readUInt16LE(eocd + 8);
    const count = buf.readUInt16LE(eocd + 10);
    const size = buf.readUInt32LE(eocd + 12);
    const centralOffset = buf.readUInt32LE(eocd + 16);
    const isZip64 = count === 0xffff || size === 0xffffffff || centralOffset === 0xffffffff;
    if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== count || isZip64) return null;
    if (count === 0 || count > MAX_ZIP_ENTRIES || centralOffset + size > eocd) return null;

    const end = centralOffset + size;
    const entries = [];
    let pos = centralOffset;
    for (let i = 0; i < count; i++) {
        if (pos + CENTRAL_HEADER_SIZE > end || buf.readUInt32LE(pos) !== CENTRAL_SIGNATURE) return null;
        const nameLength = buf.readUInt16LE(pos + 28);
        const next = pos + CENTRAL_HEADER_SIZE + nameLength + buf.readUInt16LE(pos + 30) + buf.readUInt16LE(pos + 32);
        if (next > end) return null;
        entries.push({
            name: buf.toString('latin1', pos + CENTRAL_HEADER_SIZE, pos + CENTRAL_HEADER_SIZE + nameLength),
            flags: buf.readUInt16LE(pos + 8),
            method: buf.readUInt16LE(pos + 10),
            compressedSize: buf.readUInt32LE(pos + 20),
            uncompressedSize: buf.readUInt32LE(pos + 24),
            localOffset: buf.readUInt32LE(pos + 42),
            centralOffset,
        });
        pos = next;
    }
    return entries;
};

const inflate = (data, maxBytes) => {
    try {
        return zlib.inflateRawSync(data, { maxOutputLength: maxBytes });
    } catch (err) {
        throw new ZipError(err.code === 'ERR_BUFFER_TOO_LARGE' ? 'too_big' : 'damaged', { cause: err });
    }
};

// The unpacked bytes of one entry from listZipEntries, never more than maxBytes (a positive integer).
// Sizes come from the central directory, since a local header written with a data descriptor holds zeros
// there; where the data starts comes from the local header, whose name and extra lengths can differ.
// Throws a ZipError on anything wrong.
export const readZipEntry = (buf, entry, { maxBytes }) => {
    const { flags, method, compressedSize, uncompressedSize, localOffset, centralOffset } = entry;
    if (flags & ENCRYPTED_FLAG) throw new ZipError('encrypted');
    if (method !== STORED && method !== DEFLATED) throw new ZipError('damaged');
    if (uncompressedSize > maxBytes) throw new ZipError('too_big');
    if (localOffset + LOCAL_HEADER_SIZE > centralOffset || buf.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) {
        throw new ZipError('damaged');
    }

    const dataStart = localOffset + LOCAL_HEADER_SIZE + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > centralOffset) throw new ZipError('damaged');

    const data = buf.subarray(dataStart, dataEnd);
    const content = method === STORED ? data : inflate(data, maxBytes);
    if (content.length !== uncompressedSize) throw new ZipError('damaged');
    return content;
};
