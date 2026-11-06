import { describe, test, expect } from 'vitest';
import { detectFileType } from '../utils/fileTypes.js';
import { makePng, makeJpeg, makeWebp, makeZip, makeOffice } from './helpers/fileFixtures.js';
import { makePdf } from './helpers/pdf.js';

const detected = (buffer, name) => detectFileType(buffer, name);

describe('detectFileType: accepted', () => {
    test.each([
        ['png', makePng(), 'a.png', 'image/png', 'png', true],
        ['jpeg', makeJpeg(), 'a.jpeg', 'image/jpeg', 'jpg', true],
        ['webp', makeWebp(), 'a.webp', 'image/webp', 'webp', true],
        ['pdf', makePdf(['hello']), 'a.pdf', 'application/pdf', 'pdf', false],
        ['docx', makeOffice('docx'), 'a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx', false],
        ['pptx', makeOffice('pptx'), 'a.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx', false],
        ['xlsx', makeOffice('xlsx'), 'a.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx', false],
        ['txt', Buffer.from('plain notes'), 'a.txt', 'text/plain', 'txt', false],
        ['md', Buffer.from('# Notes'), 'a.md', 'text/markdown', 'md', false],
    ])('%s', (_label, buffer, name, mimeType, ext, isImage) => {
        expect(detected(buffer, name)).toEqual({ ext, mimeType, isImage });
    });

    test('text with a UTF-8 BOM', () => {
        const text = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('Notes ภาพ')]);
        expect(detected(text, 'notes.txt')?.ext).toBe('txt');
    });

    test('the content decides for images and PDFs, not the name', () => {
        expect(detected(makePng(), 'photo.pdf')?.ext).toBe('png');
        expect(detected(makePdf(['x']), 'scan.png')?.ext).toBe('pdf');
    });

    test('an Office file with a comment after the end record', () => {
        expect(detected(makeZip(['[Content_Types].xml', 'word/document.xml'], { comment: 'made by hand' }), 'a.docx')?.ext).toBe('docx');
    });
});

describe('detectFileType: refused', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const html = Buffer.from('<!doctype html><script>alert(1)</script>');

    test.each([
        ['SVG named photo.png', svg, 'photo.png'],
        ['SVG named photo.svg', svg, 'photo.svg'],
        ['HTML named .pdf', html, 'notes.pdf'],
        ['HTML named .html', html, 'page.html'],
        ['GIF', Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'latin1'), 'a.gif'],
        ['program named .pdf', Buffer.from('MZ\x90\x00\x03\x00\x00\x00', 'latin1'), 'a.pdf'],
        ['text with a NUL byte', Buffer.from('hello\0world'), 'a.txt'],
        ['invalid UTF-8 text', Buffer.from([0x68, 0x69, 0xff, 0xfe, 0x41]), 'a.txt'],
        ['UTF-16 text', Buffer.from('\ufeffhi', 'utf16le'), 'a.txt'],
        ['text with an unknown extension', Buffer.from('hello'), 'a.exe'],
        ['empty file', Buffer.alloc(0), 'a.txt'],
        ['a PDF-looking text, too short', Buffer.from('%PDF'), 'a.pdf'],
    ])('%s', (_label, buffer, name) => {
        expect(detected(buffer, name)).toBeNull();
    });

    test('ZIP without a word/ entry named .docx', () => {
        expect(detected(makeZip(['[Content_Types].xml', 'readme.txt']), 'a.docx')).toBeNull();
    });

    test('ZIP without [Content_Types].xml', () => {
        expect(detected(makeZip(['word/document.xml']), 'a.docx')).toBeNull();
    });

    test('Office file named for another kind', () => {
        expect(detected(makeOffice('docx'), 'a.xlsx')).toBeNull();
        expect(detected(makeOffice('docx'), 'a.zip')).toBeNull();
    });

    test('a ZIP is never read as text', () => {
        expect(detected(makeZip(['a.txt']), 'a.txt')).toBeNull();
    });

    test.each([
        ['vbaProject.bin in word/', ['word/vbaProject.bin']],
        ['vbaProject.bin in xl/, any case', ['xl/VBAProject.BIN']],
        ['macro sheets', ['xl/macrosheets/sheet1.xml']],
    ])('macro-carrying file: %s', (_label, extra) => {
        expect(detected(makeOffice('docx', extra), 'a.docx')).toBeNull();
        expect(detected(makeOffice('xlsx', extra), 'a.xlsx')).toBeNull();
    });

    test('a fake end record inside the comment is not trusted', () => {
        // The real record lists no word/ entry. A planted record in the comment would claim one, but the
        // comment length of the real record does not run to the end of the file for the planted one.
        const fake = makeZip(['[Content_Types].xml', 'word/document.xml']);
        const real = makeZip(['[Content_Types].xml', 'readme.txt'], { comment: fake.toString('latin1') });
        expect(detected(real, 'a.docx')).toBeNull();
    });
});

describe('detectFileType: broken ZIPs', () => {
    const good = makeOffice('docx');

    test('truncated files do not throw', () => {
        for (let length = 0; length < good.length; length += 7) {
            expect(() => detected(good.subarray(0, length), 'a.docx')).not.toThrow();
        }
        expect(detected(good.subarray(0, good.length - 5), 'a.docx')).toBeNull();
    });

    test('a central directory that points past the file', () => {
        const bad = Buffer.from(good);
        bad.writeUInt32LE(0xfffffff0, bad.length - 6); // central directory offset
        expect(detected(bad, 'a.docx')).toBeNull();
    });

    test('an entry count above the limit', () => {
        const bad = Buffer.from(good);
        bad.writeUInt16LE(60000, bad.length - 12);
        bad.writeUInt16LE(60000, bad.length - 14);
        expect(detected(bad, 'a.docx')).toBeNull();
    });

    test('a count larger than the directory holds', () => {
        const bad = Buffer.from(good);
        bad.writeUInt16LE(9, bad.length - 12);
        bad.writeUInt16LE(9, bad.length - 14);
        expect(detected(bad, 'a.docx')).toBeNull();
    });

    test('a damaged entry header', () => {
        const bad = Buffer.from(good);
        const centralStart = bad.readUInt32LE(bad.length - 6);
        bad.writeUInt32LE(0, centralStart);
        expect(detected(bad, 'a.docx')).toBeNull();
    });
});
