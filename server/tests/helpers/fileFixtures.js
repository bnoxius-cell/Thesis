// Tiny hand-built files for the content-check tests. Only the headers are real: the checks never decode
// pixels or unpack ZIP data, so nothing here is a full image or a full Office document.

const u16be = (n) => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };
const u32be = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };

export const makePng = (width = 4, height = 3) => Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    u32be(13), Buffer.from('IHDR'), u32be(width), u32be(height), Buffer.from([8, 6, 0, 0, 0]), u32be(0),
    u32be(0), Buffer.from('IEND'), u32be(0),
]);

// SOI, an APP0 segment, then a baseline frame header (SOF0), a scan marker and EOI.
export const makeJpeg = (width = 4, height = 3) => Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    Buffer.from([0xff, 0xe0]), u16be(16), Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0'),
    Buffer.from([0xff, 0xc0]), u16be(11), Buffer.from([8]), u16be(height), u16be(width), Buffer.from([1, 1, 0x11, 0]),
    Buffer.from([0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]),
]);

// kind: 'lossy' (VP8), 'lossless' (VP8L) or 'extended' (VP8X)
export const makeWebp = (kind = 'lossy', width = 4, height = 3) => {
    let chunk;
    if (kind === 'lossy') {
        chunk = Buffer.alloc(18);
        chunk.write('VP8 ', 0, 'latin1');
        chunk.writeUInt32LE(10, 4);
        chunk.set([0x9d, 0x01, 0x2a], 11);
        chunk.writeUInt16LE(width, 14);
        chunk.writeUInt16LE(height, 16);
    } else if (kind === 'lossless') {
        chunk = Buffer.alloc(18);
        chunk.write('VP8L', 0, 'latin1');
        chunk.writeUInt32LE(10, 4);
        chunk[8] = 0x2f;
        chunk.writeUInt32LE(((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14), 9);
    } else {
        chunk = Buffer.alloc(18);
        chunk.write('VP8X', 0, 'latin1');
        chunk.writeUInt32LE(10, 4);
        chunk.writeUIntLE(width - 1, 12, 3);
        chunk.writeUIntLE(height - 1, 15, 3);
    }
    const riff = Buffer.alloc(12);
    riff.write('RIFF', 0, 'latin1');
    riff.writeUInt32LE(4 + chunk.length, 4);
    riff.write('WEBP', 8, 'latin1');
    return Buffer.concat([riff, chunk]);
};

// A stored (uncompressed) ZIP. Entry data is a placeholder and the CRC is left at 0: the checks only
// read names from the central directory. `comment` goes after the end record.
export const makeZip = (names, { comment = '' } = {}) => {
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const name of names) {
        const nameBytes = Buffer.from(name, 'latin1');
        const data = Buffer.from('x');
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(nameBytes.length, 26);
        locals.push(local, nameBytes, data);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt32LE(data.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(nameBytes.length, 28);
        central.writeUInt32LE(offset, 42);
        centrals.push(central, nameBytes);
        offset += local.length + nameBytes.length + data.length;
    }
    const centralBytes = Buffer.concat(centrals);
    const commentBytes = Buffer.from(comment, 'latin1');
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(names.length, 8);
    end.writeUInt16LE(names.length, 10);
    end.writeUInt32LE(centralBytes.length, 12);
    end.writeUInt32LE(offset, 16);
    end.writeUInt16LE(commentBytes.length, 20);
    return Buffer.concat([...locals, centralBytes, end, commentBytes]);
};

const OFFICE_FOLDERS = { docx: 'word/document.xml', pptx: 'ppt/presentation.xml', xlsx: 'xl/workbook.xml' };

// A minimal Office file of the given kind; `extra` adds more entry names (for example a macro project).
export const makeOffice = (kind, extra = []) => makeZip(['[Content_Types].xml', OFFICE_FOLDERS[kind], ...extra]);
