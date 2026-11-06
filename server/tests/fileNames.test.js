import { describe, test, expect } from 'vitest';
import { cleanFileName, contentDisposition, extensionOf } from '../utils/fileNames.js';

const isPureAscii = (text) => [...text].every((char) => char.charCodeAt(0) < 128);
const fallbackOf = (header) => /filename="([^"]*)"/.exec(header)[1];
const encodedOf = (header) => /filename\*=UTF-8''(.+)$/.exec(header)[1];

describe('extensionOf', () => {
    test('last extension, lower case', () => {
        expect(extensionOf('Notes.PDF')).toBe('pdf');
        expect(extensionOf('a.tar.gz')).toBe('gz');
    });

    test('none', () => {
        expect(extensionOf('notes')).toBe('');
        expect(extensionOf('notes.')).toBe('');
        expect(extensionOf(undefined)).toBe('');
    });
});

describe('cleanFileName', () => {
    test('forces the detected extension', () => {
        expect(cleanFileName('notes.pdf', 'pdf')).toBe('notes.pdf');
        expect(cleanFileName('Notes.PDF', 'pdf')).toBe('Notes.pdf');
        expect(cleanFileName('photo.jpeg', 'jpg')).toBe('photo.jpg');
        expect(cleanFileName('notes', 'pdf')).toBe('notes.pdf');
        expect(cleanFileName('v1.2 draft', 'docx')).toBe('v1.2 draft.docx');
    });

    test('a right-to-left override can not fake an extension', () => {
        const cleaned = cleanFileName('\u202egnp.exe', 'pdf');
        expect(cleaned).not.toContain('\u202e');
        expect(cleaned.endsWith('.pdf')).toBe(true);
    });

    test('path parts and double extensions are gone', () => {
        const cleaned = cleanFileName('../../notes.pdf.exe', 'pdf');
        expect(cleaned).toBe('notes.pdf');
        expect(cleaned).not.toContain('/');
        expect(cleanFileName('C:\\Users\\me\\report.docx.js', 'docx')).toBe('report.docx');
    });

    test('control characters and reserved characters are stripped', () => {
        expect(cleanFileName('a\u0000b\r\nc:d*e?f"g<h>i|j.png', 'png')).toBe('abcdefghij.png');
        expect(cleanFileName('zero\u200bwidth\ufeff.png', 'png')).toBe('zerowidth.png');
    });

    test('a name that is nothing but junk becomes "file"', () => {
        expect(cleanFileName('', 'pdf')).toBe('file.pdf');
        expect(cleanFileName('...', 'pdf')).toBe('file.pdf');
        expect(cleanFileName('/\\:*', 'pdf')).toBe('file.pdf');
        expect(cleanFileName('.pdf', 'pdf')).toBe('file.pdf');
        expect(cleanFileName('report.pdf.', 'pdf')).toBe('report.pdf');
        expect(cleanFileName(null, 'pdf')).toBe('file.pdf');
        expect(cleanFileName(42, 'pdf')).toBe('file.pdf');
    });

    test('a 200 character name is cut to 120 plus the extension', () => {
        expect(cleanFileName(`${'a'.repeat(200)}.pdf`, 'pdf')).toBe(`${'a'.repeat(120)}.pdf`);
    });

    test('the cut never splits a character outside the basic plane', () => {
        const cleaned = cleanFileName(`${'😀'.repeat(150)}.png`, 'png');
        expect(Array.from(cleaned.slice(0, -4))).toHaveLength(120);
        expect(cleaned.isWellFormed()).toBe(true);
    });

    test('keeps ordinary non-Latin names', () => {
        expect(cleanFileName('ภาพ ถ่าย.png', 'png')).toBe('ภาพ ถ่าย.png');
    });

    test('lone surrogates are replaced, so the name stays well-formed', () => {
        expect(cleanFileName('a\ud800b.png', 'png').isWellFormed()).toBe(true);
    });
});

describe('contentDisposition', () => {
    test('header injection attempt', () => {
        const header = contentDisposition('"\r\nSet-Cookie: x.pdf');
        expect(isPureAscii(header)).toBe(true);
        expect(header).not.toMatch(/[\r\n]/);
        expect(header.startsWith('attachment; filename="')).toBe(true);
        expect(header.match(/"/g)).toHaveLength(2); // only the two around the fallback
        expect(encodedOf(header)).toMatch(/^[A-Za-z0-9%._~!-]+$/);
    });

    test('inline for photos, pure ASCII even for a Thai name', () => {
        const header = contentDisposition('ภาพ.png', { inline: true });
        expect(header.startsWith('inline;')).toBe(true);
        expect(isPureAscii(header)).toBe(true);
        expect(decodeURIComponent(encodedOf(header))).toBe('ภาพ.png');
    });

    test("quotes, brackets and stars are escaped in filename* and decode back", () => {
        const header = contentDisposition("Ana's (final) *draft* 100%.docx");
        expect(encodedOf(header)).not.toMatch(/['()*]/);
        expect(decodeURIComponent(encodedOf(header))).toBe("Ana's (final) draft 100%.docx");
    });

    test('a percent sign never reaches the fallback', () => {
        expect(fallbackOf(contentDisposition('100%.pdf'))).toBe('100_.pdf');
    });

    test('attachment by default; nothing usable becomes "file"', () => {
        expect(contentDisposition('notes.pdf').startsWith('attachment;')).toBe(true);
        expect(contentDisposition('')).toBe(`attachment; filename="file"; filename*=UTF-8''file`);
        expect(contentDisposition(undefined)).toBe(`attachment; filename="file"; filename*=UTF-8''file`);
    });

    test('lone surrogates do not throw', () => {
        expect(() => contentDisposition('a\ud800.png')).not.toThrow();
    });
});
