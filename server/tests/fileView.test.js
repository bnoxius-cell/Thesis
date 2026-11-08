import { describe, test, expect } from 'vitest';
import { viewKindOf, looksLikePdf, previewText, TEXT_PREVIEW_CHARS, PDF_TYPE } from '../../client/src/utils/fileView.js';

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
