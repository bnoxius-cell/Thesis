import { extractText, getDocumentProxy } from 'unpdf';

// Pulls the text out of an uploaded PDF. Kept in its own module so tests have a local seam
// to mock, like holidays.js and googleAuth.js. Scanned pages have no text layer, so they come
// back (nearly) empty; the controller turns that into a friendly message. No OCR.

// Enough for a long lecture handout. Anything past this is cut, and the reviewer says so.
export const MAX_SOURCE_CHARS = 120000;
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
