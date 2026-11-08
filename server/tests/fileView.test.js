import { describe, test, expect } from 'vitest';
import {
    viewKindOf, looksLikePdf, previewText, TEXT_PREVIEW_CHARS, PDF_TYPE,
    blobTypeOf, bytesFit, statusStep, blobsToDrop, MAX_BLOBS, MAX_BLOB_BYTES,
} from '../../client/src/utils/fileView.js';

const bytes = (text) => new TextEncoder().encode(text);

describe('viewKindOf', () => {
    test.each([
        ['pdf', 'pdf'],
        ['txt', 'text'], ['md', 'text'], ['markdown', 'text'],
        ['png', 'photo'], ['jpg', 'photo'], ['jpeg', 'photo'], ['webp', 'photo'],
        ['docx', 'none'], ['pptx', 'none'], ['xlsx', 'none'],
    ])('%s is %s', (ext, kind) => {
        expect(viewKindOf(ext)).toBe(kind);
    });

    test('upper case extensions count', () => {
        expect(viewKindOf('PDF')).toBe('pdf');
        expect(viewKindOf('Md')).toBe('text');
    });

    test('unknown, empty and missing extensions show nothing', () => {
        expect(viewKindOf('html')).toBe('none');
        expect(viewKindOf('svg')).toBe('none');
        expect(viewKindOf('')).toBe('none');
        expect(viewKindOf(undefined)).toBe('none');
        expect(viewKindOf('constructor')).toBe('none');
    });
});

describe('looksLikePdf', () => {
    test('a PDF header', () => {
        expect(looksLikePdf(bytes('%PDF-1.7\n%...'))).toBe(true);
        expect(looksLikePdf(bytes('%PDF-'))).toBe(true);
    });

    test('anything else', () => {
        expect(looksLikePdf(bytes('<html><script>'))).toBe(false);
        expect(looksLikePdf(bytes('%PDF'))).toBe(false);
        expect(looksLikePdf(bytes(' %PDF-1.7'))).toBe(false);
        expect(looksLikePdf(new Uint8Array())).toBe(false);
    });

    test('the type a PDF Blob gets', () => {
        expect(PDF_TYPE).toBe('application/pdf');
    });
});

describe('previewText', () => {
    test('short text stays whole', () => {
        expect(previewText('hello')).toEqual({ text: 'hello', cut: false });
        expect(previewText('')).toEqual({ text: '', cut: false });
    });

    test('text of exactly the limit is not cut', () => {
        const text = 'a'.repeat(TEXT_PREVIEW_CHARS);
        expect(previewText(text)).toEqual({ text, cut: false });
    });

    test('longer text is cut at exactly 200,000 characters', () => {
        const { text, cut } = previewText('b'.repeat(TEXT_PREVIEW_CHARS + 1));
        expect(TEXT_PREVIEW_CHARS).toBe(200_000);
        expect(text).toHaveLength(200_000);
        expect(cut).toBe(true);
    });
});

describe('blobTypeOf', () => {
    test('a PDF and text get their own types, from the extension only', () => {
        expect(blobTypeOf('pdf')).toBe('application/pdf');
        expect(blobTypeOf('PDF')).toBe('application/pdf');
        expect(blobTypeOf('txt')).toBe('text/plain');
        expect(blobTypeOf('md')).toBe('text/plain');
    });

    test('everything else is plain bytes, never HTML or SVG', () => {
        for (const ext of ['html', 'svg', 'docx', 'png', '', undefined]) {
            expect(blobTypeOf(ext)).toBe('application/octet-stream');
        }
    });
});

describe('bytesFit', () => {
    const pdf = bytes('%PDF-1.7 body');

    test('a PDF of the listed size that starts %PDF- fits', () => {
        expect(bytesFit({ ext: 'pdf', size: pdf.length }, pdf)).toBe(true);
    });

    test('a .pdf whose bytes are not a PDF does not', () => {
        const html = bytes('<html><script>');
        expect(bytesFit({ ext: 'pdf', size: html.length }, html)).toBe(false);
    });

    test('a size that differs from the row does not, for any kind', () => {
        expect(bytesFit({ ext: 'pdf', size: pdf.length + 1 }, pdf)).toBe(false);
        expect(bytesFit({ ext: 'txt', size: 3 }, bytes('four'))).toBe(false);
    });

    test('text needs no header', () => {
        const text = bytes('<html> is fine as text');
        expect(bytesFit({ ext: 'txt', size: text.length }, text)).toBe(true);
    });
});

describe('statusStep', () => {
    test('a 2xx answer is read', () => {
        expect(statusStep(200, false)).toBe('read');
        expect(statusStep(200, true)).toBe('read');
    });

    test('a 403 is tried once more with a fresh link, then fails (only if the storage sends CORS on errors)', () => {
        expect(statusStep(403, false)).toBe('retry');
        expect(statusStep(403, true)).toBe('fail');
    });

    test('any other error status fails at once', () => {
        for (const status of [400, 404, 500, 503, 304]) expect(statusStep(status, false)).toBe('fail');
    });
});

describe('blobsToDrop', () => {
    const MB = 1024 * 1024;

    test('the limits are 5 files and 30 MB', () => {
        expect(MAX_BLOBS).toBe(5);
        expect(MAX_BLOB_BYTES).toBe(30 * MB);
    });

    test('nothing goes while both limits hold', () => {
        expect(blobsToDrop([])).toEqual([]);
        expect(blobsToDrop([['a', MB], ['b', MB], ['c', MB], ['d', MB], ['e', MB]])).toEqual([]);
        expect(blobsToDrop([['a', 30 * MB]])).toEqual([]);
    });

    test('a sixth file pushes out the oldest', () => {
        expect(blobsToDrop([['a', 1], ['b', 1], ['c', 1], ['d', 1], ['e', 1], ['f', 1]])).toEqual(['a']);
    });

    test('going over 30 MB drops the oldest until it fits', () => {
        expect(blobsToDrop([['a', 10 * MB], ['b', 10 * MB], ['c', 10 * MB], ['d', 15 * MB]])).toEqual(['a', 'b']);
    });

    test('one file over the limit on its own goes too', () => {
        expect(blobsToDrop([['a', MB], ['big', 31 * MB]])).toEqual(['a', 'big']);
    });
});
