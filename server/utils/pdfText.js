import { extractText, getDocumentProxy } from 'unpdf';

// Pulls the text out of an uploaded PDF. Kept in its own module so tests have a local seam
// to mock, like holidays.js and googleAuth.js. Scanned pages have no text layer, so they come
// back (nearly) empty; the controller turns that into a friendly message. No OCR.

// How much text goes to Gemini in one request. Longer material is split into parts of about
// this size, each part is sent on its own, and the answers are merged (see reviewerContent.js).
export const PART_CHARS = 120000;
export const MAX_PARTS = 3;
// About 150 pages of dense notes. Anything past this is cut, and the reviewer says so.
export const MAX_SOURCE_CHARS = PART_CHARS * MAX_PARTS;
// Below this there isn't enough material to write a useful reviewer.
export const MIN_SOURCE_CHARS = 300;

// A lone page number ("12", "Page 3 of 20", "- 4 -") on its own line is just noise.
const PAGE_NUMBER_LINE = /^\s*(?:page\s+)?[-–]?\s*\d{1,4}\s*(?:of\s+\d{1,4})?\s*[-–]?\s*$/i;

export const cleanPageText = (text) => String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .filter((line) => line && !PAGE_NUMBER_LINE.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');

// The break closest to `ideal` between `from` and `to`: a paragraph break if there is one, then
// a line break, then a space. Falls back to cutting at `ideal`.
const breakNear = (text, ideal, from, to) => {
    for (const mark of ['\n\n', '\n', ' ']) {
        const found = [text.lastIndexOf(mark, ideal), text.indexOf(mark, ideal)].filter((i) => i >= from && i <= to);
        if (found.length) return found.reduce((a, b) => (Math.abs(a - ideal) <= Math.abs(b - ideal) ? a : b));
    }
    return ideal;
};

// Splits text that is too long for one request into parts of about the same size, cut at a
// paragraph break near each ideal cut point. Short text comes back as a single part. The same
// text always splits the same way, so a part number stays meaningful later.
export const splitIntoParts = (text, partChars = PART_CHARS) => {
    const source = String(text || '').trim();
    if (!source) return [];
    const count = Math.ceil(source.length / partChars);
    if (count <= 1) return [source];

    const size = source.length / count;
    const reach = Math.round(size * 0.1);
    const parts = [];
    let start = 0;
    for (let k = 1; k < count; k += 1) {
        const ideal = Math.round(size * k);
        const cut = breakNear(source, ideal, Math.max(start + 1, ideal - reach), ideal + reach);
        parts.push(source.slice(start, cut).trim());
        start = cut;
    }
    parts.push(source.slice(start).trim());
    return parts.filter(Boolean);
};

export const isPdfBuffer = (buffer) =>
    Buffer.isBuffer(buffer) && buffer.length > 4 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';

export const extractPdfText = async (buffer) => {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    try {
        const { totalPages, text } = await extractText(pdf, { mergePages: false });
        const pages = Array.isArray(text) ? text : [text];
        const full = pages.map(cleanPageText).filter(Boolean).join('\n\n');
        const truncated = full.length > MAX_SOURCE_CHARS;
        return {
            text: truncated ? full.slice(0, MAX_SOURCE_CHARS) : full,
            pages: totalPages,
            chars: full.length,
            truncated,
        };
    } finally {
        await pdf.destroy?.();
    }
};
