// Tiny hand-built files for the content-check tests. Only the headers are real: the checks never decode
// pixels, so nothing here is a full image. ZIP entries can carry real data for the ZIP and Office readers.

import zlib from 'node:zlib';

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

const DATA_DESCRIPTOR_FLAG = 0x0008;

// A ZIP built by hand. Each entry is a name (stored, with a one-byte placeholder) or
// { name, data, deflate, flags, method, localExtra }: `data` is a string or Buffer, `deflate` packs it,
// `method` overrides the method number written (the data is then left as given), `flags` goes in both
// headers (bit 3 writes a data descriptor and zero sizes in the local header), and `localExtra` is an
// extra field in the local header only. The CRC is left at 0: the reader doesn't check it.
// `comment` goes after the end record.
export const makeZip = (entries, { comment = '' } = {}) => {
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const entry of entries) {
        const { name, data = 'x', deflate = false, flags = 0, method = deflate ? 8 : 0, localExtra = Buffer.alloc(0) } =
            typeof entry === 'string' ? { name: entry } : entry;
        const nameBytes = Buffer.from(name, 'latin1');
        const raw = Buffer.from(data);
        const packed = deflate ? zlib.deflateRawSync(raw) : raw;
        const hasDescriptor = Boolean(flags & DATA_DESCRIPTOR_FLAG);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(flags, 6);
        local.writeUInt16LE(method, 8);
        local.writeUInt32LE(hasDescriptor ? 0 : packed.length, 18);
        local.writeUInt32LE(hasDescriptor ? 0 : raw.length, 22);
        local.writeUInt16LE(nameBytes.length, 26);
        local.writeUInt16LE(localExtra.length, 28);
        const descriptor = Buffer.alloc(hasDescriptor ? 16 : 0);
        if (hasDescriptor) {
            descriptor.writeUInt32LE(0x08074b50, 0);
            descriptor.writeUInt32LE(packed.length, 8);
            descriptor.writeUInt32LE(raw.length, 12);
        }
        locals.push(local, nameBytes, localExtra, packed, descriptor);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(flags, 8);
        central.writeUInt16LE(method, 10);
        central.writeUInt32LE(packed.length, 20);
        central.writeUInt32LE(raw.length, 24);
        central.writeUInt16LE(nameBytes.length, 28);
        central.writeUInt32LE(offset, 42);
        centrals.push(central, nameBytes);
        offset += local.length + nameBytes.length + localExtra.length + packed.length + descriptor.length;
    }
    const centralBytes = Buffer.concat(centrals);
    const commentBytes = Buffer.from(comment, 'latin1');
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralBytes.length, 12);
    end.writeUInt32LE(offset, 16);
    end.writeUInt16LE(commentBytes.length, 20);
    return Buffer.concat([...locals, centralBytes, end, commentBytes]);
};

const OFFICE_FOLDERS = { docx: 'word/document.xml', pptx: 'ppt/presentation.xml', xlsx: 'xl/workbook.xml' };

// A minimal Office file of the given kind; `extra` adds more entry names (for example a macro project).
export const makeOffice = (kind, extra = []) => makeZip(['[Content_Types].xml', OFFICE_FOLDERS[kind], ...extra]);

const escapeXml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const XMLNS_W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const XMLNS_P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

// A real Word file whose body has one paragraph per line, so the text reader can run on it.
export const makeDocx = (lines) => makeZip([
    '[Content_Types].xml',
    {
        name: 'word/document.xml',
        data: `<w:document ${XMLNS_W}><w:body>${lines.map((line) => `<w:p><w:r><w:t>${escapeXml(line)}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`,
        deflate: true,
    },
]);

// A real PowerPoint file: `slides` is an array of line arrays (slide 1 first). `order` lists slide indexes
// in show order when that isn't the numbering.
export const makePptx = (slides, { order = slides.map((_, i) => i) } = {}) => makeZip([
    '[Content_Types].xml',
    {
        name: 'ppt/presentation.xml',
        data: `<p:presentation ${XMLNS_P}><p:sldIdLst>${order.map((n, i) => `<p:sldId id="${256 + i}" r:id="rId${n + 1}"/>`).join('')}</p:sldIdLst></p:presentation>`,
        deflate: true,
    },
    {
        name: 'ppt/_rels/presentation.xml.rels',
        data: `<Relationships>${slides.map((_, n) => `<Relationship Id="rId${n + 1}" Type="slide" Target="slides/slide${n + 1}.xml"/>`).join('')}</Relationships>`,
        deflate: true,
    },
    ...slides.map((lines, n) => ({
        name: `ppt/slides/slide${n + 1}.xml`,
        data: `<p:sld ${XMLNS_P}><p:cSld><p:spTree><p:sp><p:txBody>${lines.map((line) => `<a:p><a:r><a:t>${escapeXml(line)}</a:t></a:r></a:p>`).join('')}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
        deflate: true,
    })),
]);
