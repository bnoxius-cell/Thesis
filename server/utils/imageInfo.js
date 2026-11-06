// Reads the pixel size of a PNG, JPEG or WebP from its headers alone. Nothing is decoded, so a file
// that claims 50,000 x 50,000 pixels costs nothing to refuse. Pure: bytes in, size or null out.

export const MAX_IMAGE_SIDE = 10000;
export const MAX_IMAGE_PIXELS = 40_000_000; // decompression bombs on the receivers' phones

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const pngSize = (buf) => {
    if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE) || buf.toString('latin1', 12, 16) !== 'IHDR') return null;
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
};

// Markers with no length field: TEM, SOI, and RST0 to RST7.
const isStandaloneMarker = (marker) => marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7);
// SOF0 to SOF15, except DHT (C4), JPG (C8) and DAC (CC), which share the range.
const isFrameMarker = (marker) => marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);

const jpegSize = (buf) => {
    if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
    let pos = 2;
    while (pos + 4 <= buf.length) {
        if (buf[pos] !== 0xff) return null;
        const marker = buf[pos + 1];
        if (marker === 0xff) { pos += 1; continue; } // fill byte before a marker
        if (isStandaloneMarker(marker)) { pos += 2; continue; }
        if (marker === 0xd9 || marker === 0xda) return null; // end of image or start of scan before any frame header
        const length = buf.readUInt16BE(pos + 2);
        if (length < 2) return null; // would loop forever
        if (isFrameMarker(marker)) {
            if (length < 7 || pos + 9 > buf.length) return null;
            return { height: buf.readUInt16BE(pos + 5), width: buf.readUInt16BE(pos + 7) };
        }
        pos += 2 + length;
    }
    return null;
};

const webpSize = (buf) => {
    if (buf.length < 30 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') return null;
    switch (buf.toString('latin1', 12, 16)) {
        case 'VP8 ': // lossy: frame tag, start code 9d 01 2a, then two 14-bit sizes
            if (buf.readUIntBE(23, 3) !== 0x9d012a) return null;
            return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
        case 'VP8L': { // lossless: signature byte 2f, then two 14-bit sizes stored minus one
            if (buf[20] !== 0x2f) return null;
            const bits = buf.readUInt32LE(21);
            return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
        }
        case 'VP8X': // extended: 24-bit sizes stored minus one
            return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
        default:
            return null;
    }
};

// { width, height } for a readable image within the size limits, otherwise null.
export const imageInfo = (buffer) => {
    if (!Buffer.isBuffer(buffer)) return null;
    const size = pngSize(buffer) ?? jpegSize(buffer) ?? webpSize(buffer);
    if (!size) return null;
    const { width, height } = size;
    if (width < 1 || height < 1 || width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE || width * height > MAX_IMAGE_PIXELS) return null;
    return size;
};
