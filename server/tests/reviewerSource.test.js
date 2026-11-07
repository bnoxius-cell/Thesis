import { describe, test, expect } from 'vitest';
import {
    MAX_NOTES_CHARS, MAX_SOURCES_BYTES, REVIEWER_SOURCE_TYPES, SourceError, cleanNotes, combineSources, displayName, fitSources,
    isScannedPdf, readSourceText, sourceFingerprint, sourceSlots, sourceTypeOf, tooLittleTextError,
} from '../utils/reviewerSource.js';
import { MAX_SOURCE_CHARS, MIN_SOURCE_CHARS } from '../utils/pdfText.js';
import { makeDocx, makeJpeg, makeOffice, makePng, makePptx, makeWebp, makeZip } from './helpers/fileFixtures.js';
import { STUDY_LINES, makeImageOnlyPdf, makePagedPdf, makePdf } from './helpers/pdf.js';

const refusal = (fn) => {
    try {
        fn();
    } catch (error) {
        expect(error).toBeInstanceOf(SourceError);
        return error;
    }
    throw new Error('expected a SourceError');
};
const asyncRefusal = (promise) => promise.then(() => { throw new Error('expected a SourceError'); }, (error) => {
    expect(error).toBeInstanceOf(SourceError);
    return error;
});

describe('fitSources', () => {
    test('leaves everything alone when it fits', () => {
        expect(fitSources([100, 200, 300], 1000)).toEqual([100, 200, 300]);
    });

    test('a short source keeps all of it and the long ones share the rest equally', () => {
        expect(fitSources([10, 500_000, 500_000], 360_000)).toEqual([10, 179_995, 179_995]);
    });

    test('keeps the order and never goes over the budget', () => {
        const kept = fitSources([300_000, 50, 200_000], 360_000);
        expect(kept[1]).toBe(50);
        expect(kept[0]).toBeLessThanOrEqual(300_000);
        expect(kept.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(360_000);
        expect(kept[0]).toBeGreaterThanOrEqual(kept[2]);
    });

    test('equal sources get equal shares', () => {
        expect(fitSources([400_000, 400_000, 400_000], 360_000)).toEqual([120_000, 120_000, 120_000]);
    });
});

describe('isScannedPdf', () => {
    test('needs at least 300 characters and 40 per page', () => {
        expect(isScannedPdf(299, 1)).toBe(true);
        expect(isScannedPdf(300, 1)).toBe(false);
        expect(isScannedPdf(1199, 30)).toBe(true);
        expect(isScannedPdf(1200, 30)).toBe(false);
    });
});

describe('cleanNotes', () => {
    test('plain line endings, no control characters', () => {
        const raw = `${'Line one of the notes.\r\n'.repeat(15)}tab\there\u0000 and a bell\u0007.\r\n`;
        const text = cleanNotes(raw);
        expect(text).not.toMatch(/[\r\u0000\u0007]/);
        expect(text).toContain('tab here');
        expect(text).toContain('and a bell.');
    });

    test('refuses short and long notes instead of cutting them', () => {
        expect(refusal(() => cleanNotes('x'.repeat(MIN_SOURCE_CHARS - 1)))).toMatchObject({ status: 400, message: 'Add a bit more. Notes need at least 300 characters.' });
        const long = refusal(() => cleanNotes('abcdefgh '.repeat(MAX_NOTES_CHARS / 8)));
        expect(long).toMatchObject({ status: 413, message: 'Your notes are too long. The limit is 100,000 characters.' });
        expect(cleanNotes('a'.repeat(MIN_SOURCE_CHARS))).toHaveLength(MIN_SOURCE_CHARS);
    });

    test('anything but a string is a bad upload', () => {
        expect(refusal(() => cleanNotes(['a', 'b']))).toMatchObject({ status: 400, code: 'bad_upload' });
        expect(refusal(() => cleanNotes({}))).toMatchObject({ code: 'bad_upload' });
    });
});

describe('sourceFingerprint', () => {
    test('same parts give the same value; kind and order matter', () => {
        expect(sourceFingerprint('upload', ['a', 'b'])).toBe(sourceFingerprint('upload', ['a', 'b']));
        expect(sourceFingerprint('upload', ['a', 'b'])).not.toBe(sourceFingerprint('upload', ['b', 'a']));
        expect(sourceFingerprint('upload', ['a'])).not.toBe(sourceFingerprint('picked', ['a']));
        expect(sourceFingerprint('upload', ['a'])).toMatch(/^[0-9a-f]{64}$/);
    });
});

describe('displayName', () => {
    test('one line, no invisible or control characters, not too long', () => {
        expect(displayName('  my‮ notes\n\u0000.pdf ')).toBe('my notes .pdf');
        expect(displayName('x'.repeat(500))).toHaveLength(120);
        expect(displayName('')).toBe('file');
        expect(displayName(undefined)).toBe('file');
    });
});

describe('sourceTypeOf', () => {
    test('knows the six types from their bytes, whatever the name says', () => {
        expect(sourceTypeOf(makePdf(STUDY_LINES), 'a.txt')).toEqual({ ext: 'pdf', kind: 'pdf' });
        expect(sourceTypeOf(makeDocx(['x']), 'a.docx')).toEqual({ ext: 'docx', kind: 'docx' });
        expect(sourceTypeOf(makePptx([['x']]), 'a.pptx')).toEqual({ ext: 'pptx', kind: 'pptx' });
        expect(sourceTypeOf(makePng(), 'a.pdf')).toEqual({ ext: 'png', kind: 'image' });
        expect(sourceTypeOf(makeJpeg(), 'a.png')).toEqual({ ext: 'jpg', kind: 'image' });
        expect(sourceTypeOf(makeWebp(), 'a.jpg')).toEqual({ ext: 'webp', kind: 'image' });
        expect([...REVIEWER_SOURCE_TYPES].sort()).toEqual(['docx', 'jpg', 'pdf', 'png', 'pptx', 'webp']);
    });

    test('refuses everything else, naming the file', () => {
        const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
        const cases = [
            ['sheet.xlsx', makeOffice('xlsx')],
            ['notes.txt', Buffer.from('plain text notes')],
            ['anim.gif', Buffer.from('GIF89a\u0001\u0000\u0001\u0000', 'latin1')],
            ['logo.png', svg],
            ['macro.docx', makeOffice('docx', ['word/vbaProject.bin'])],
            ['fake.docx', makeZip(['[Content_Types].xml', 'other/file.xml'])],
            ['empty.pdf', Buffer.alloc(0)],
            ['bad.png', Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)])],
        ];
        for (const [name, buffer] of cases) {
            expect(refusal(() => sourceTypeOf(buffer, name)), name).toMatchObject({ status: 400, code: 'bad_type' });
            expect(refusal(() => sourceTypeOf(buffer, name)).message, name).toContain(`${name} can't be made into a reviewer`);
        }
    });

    test('an old or password-protected Word or PowerPoint file (OLE) is 422, other OLE files are not allowed', () => {
        const ole = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(100)]);
        for (const name of ['notes.docx', 'old.doc', 'slides.pptx', 'old.ppt']) {
            expect(refusal(() => sourceTypeOf(ole, name)), name).toMatchObject({ status: 422, code: 'cannot_open' });
        }
        expect(refusal(() => sourceTypeOf(ole, 'sheet.xls'))).toMatchObject({ status: 400, code: 'bad_type' });
        expect(refusal(() => sourceTypeOf(ole, 'notes.docx')).message).toBe(
            "We can't open notes.docx. If it has a password, remove it. If it's an old .doc or .ppt file, save it as .docx or .pptx first.",
        );
    });
});

describe('readSourceText', () => {
    test('reads a PDF, a Word file and a PowerPoint file', async () => {
        const pdf = await readSourceText('pdf', makePdf(STUDY_LINES), 'a.pdf');
        expect(pdf).toMatchObject({ pages: 1, truncated: false });
        expect(pdf.text).toContain('RuBisCO');

        const docx = await readSourceText('docx', makeDocx(STUDY_LINES), 'a.docx');
        expect(docx.text).toContain('Calvin cycle');
        expect(docx.pages).toBeNull();

        const pptx = await readSourceText('pptx', makePptx([STUDY_LINES.slice(0, 3), STUDY_LINES.slice(3, 8)]), 'a.pptx');
        expect(pptx.slides).toBe(2);
        expect(pptx.text.indexOf('Slide 1')).toBeLessThan(pptx.text.indexOf('Slide 2'));
    });

    test('a scanned PDF is refused for now; a long scan with a little text says so', async () => {
        expect(await asyncRefusal(readSourceText('pdf', makeImageOnlyPdf(), 'scan.pdf'))).toMatchObject({
            status: 422, message: "Photos and scanned PDFs can't be read yet.",
        });
        const pages = Array.from({ length: 16 }, () => ['x']);
        expect(await asyncRefusal(readSourceText('pdf', makePagedPdf(pages), 'long scan.pdf'))).toMatchObject({
            status: 422, code: 'scanned_long',
        });
    });

    test('a long PDF with enough text, though thin, is read', async () => {
        const pages = Array.from({ length: 16 }, (_, i) => (i === 0 ? STUDY_LINES : ['x']));
        const read = await readSourceText('pdf', makePagedPdf(pages), 'long.pdf');
        expect(read.pages).toBe(16);
        expect(read.chars).toBeGreaterThan(MIN_SOURCE_CHARS);
    });

    test('a password-protected or damaged PDF names the file', async () => {
        expect(await asyncRefusal(readSourceText('pdf', makePagedPdf([STUDY_LINES], { encrypt: true }), 'locked.pdf'))).toMatchObject({
            status: 422, message: 'locked.pdf is password protected. Remove the password and add it again.',
        });
        expect(await asyncRefusal(readSourceText('pdf', Buffer.from('%PDF-1.7\n'), 'broken.pdf'))).toMatchObject({
            status: 422, message: "We couldn't read broken.pdf. It may be damaged. Try saving it again, or as a PDF.",
        });
    });

    test('damaged, encrypted and oversized Office files', async () => {
        const noBody = makeZip(['[Content_Types].xml', 'word/styles.xml']);
        expect(await asyncRefusal(readSourceText('docx', noBody, 'a.docx'))).toMatchObject({ status: 422, code: 'damaged' });

        const encrypted = makeZip(['[Content_Types].xml', { name: 'word/document.xml', flags: 1 }]);
        expect(await asyncRefusal(readSourceText('docx', encrypted, 'locked.docx'))).toMatchObject({ status: 422, code: 'damaged' });

        const huge = makeZip(['[Content_Types].xml', { name: 'word/document.xml', data: `<w:t>${'a'.repeat(26 * 1024 * 1024)}</w:t>`, deflate: true }]);
        expect(await asyncRefusal(readSourceText('docx', huge, 'huge.docx'))).toMatchObject({
            status: 422, message: 'huge.docx is too big inside for us to read. Try saving it as a PDF, or split it.',
        });
    });
});

describe('combineSources', () => {
    const source = (kind, fileName, text, extra = {}) => ({ kind, fileName, text, pages: null, slides: null, chars: text.length, truncated: false, bytes: 1000, file: null, ...extra });

    test('one source has no header and keeps its type', () => {
        const combined = combineSources([source('docx', 'Notes.docx', 'Some text here.')], 'fp');
        expect(combined.text).toBe('Some text here.');
        expect(combined.summary).toMatchObject({ type: 'docx', fileName: 'Notes.docx', count: 1, chars: 15, truncated: false, fingerprint: 'fp' });
        expect(combined.items).toEqual([expect.objectContaining({ type: 'docx', read: 'text', skipped: false, file: null })]);
        expect(combined.items[0]).not.toHaveProperty('body');
    });

    test('several sources get "Source N: name" headers in order, and a mixed type', () => {
        const combined = combineSources([
            source('pdf', 'a.pdf', 'First text.', { pages: 3 }),
            source('docx', 'b.docx', 'Second text.'),
            source('pptx', 'c.pptx', 'Third text.', { slides: 7 }),
        ], 'fp');
        expect(combined.text).toBe('Source 1: a.pdf\nFirst text.\n\nSource 2: b.docx\nSecond text.\n\nSource 3: c.pptx\nThird text.');
        expect(combined.summary).toMatchObject({ type: 'mixed', fileName: 'a.pdf', count: 3, pages: 3, slides: 7 });
        expect(combined.items.map((item) => item.type)).toEqual(['pdf', 'docx', 'pptx']);
    });

    test('over the budget, the text stays within it and every source is still there', () => {
        const long = (letter, n) => `${letter}`.repeat(n);
        const combined = combineSources([source('docx', 'big.docx', long('a', 300_000)), source('docx', 'mid.docx', long('b', 200_000))], 'fp');
        expect(combined.text.length).toBeLessThanOrEqual(MAX_SOURCE_CHARS);
        expect(combined.text).toContain('Source 1: big.docx');
        expect(combined.text).toContain('Source 2: mid.docx');
        expect(combined.items.every((item) => item.truncated)).toBe(true);
        const kept = (letter) => combined.text.split(letter).length - 1;
        expect(kept('a')).toBeGreaterThan(100_000);
        expect(kept('b')).toBeGreaterThan(100_000);
        // The summary still reports the full lengths.
        expect(combined.summary).toMatchObject({ chars: 500_000, truncated: true });
    });

    test('tooLittleTextError picks the message for one file or several', () => {
        expect(tooLittleTextError([{ type: 'pdf' }]).message).toBe("This PDF doesn't have enough text to make a reviewer.");
        expect(tooLittleTextError([{ type: 'docx' }]).message).toBe("This Word file doesn't have enough text to make a reviewer.");
        expect(tooLittleTextError([{ type: 'pptx' }]).message).toMatch(/^These slides don't have enough text.*add photos of them instead\.$/);
        expect(tooLittleTextError([{ type: 'pdf' }, { type: 'pdf' }]).message).toBe("These files don't have enough text to make a reviewer.");
    });
});

describe('sourceSlots', () => {
    test('hands out two, then none; a release frees one, and only once', () => {
        const base = sourceSlots.inUse();
        const first = sourceSlots.take();
        const second = sourceSlots.take();
        expect(first).toBeTypeOf('function');
        expect(second).toBeTypeOf('function');
        expect(sourceSlots.take()).toBeNull();
        first();
        first();
        expect(sourceSlots.inUse()).toBe(base + 1);
        const third = sourceSlots.take();
        expect(third).toBeTypeOf('function');
        expect(sourceSlots.take()).toBeNull();
        second();
        third();
        expect(sourceSlots.inUse()).toBe(base);
    });
});

test('the per-reviewer cap is 20 MB', () => {
    expect(MAX_SOURCES_BYTES).toBe(20 * 1024 * 1024);
});
