import { describe, test, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import stripOfficeMedia from '../../client/src/features/files/stripOfficeMedia.js';
import shrinkPhoto from '../../client/src/features/files/shrinkPhoto.js';
import prepareSources from '../../client/src/features/study/prepareSources.js';
import { extractDocxText, extractPptxText } from '../utils/officeText.js';
import { MIN_SOURCE_CHARS } from '../utils/pdfText.js';
import { detectFileType } from '../utils/fileTypes.js';
import { listZipEntries } from '../utils/zipEntries.js';
import { makeDocx, makePng, makePptx } from './helpers/fileFixtures.js';

const MB = 1024 * 1024;
const MODIFIED = 1_700_000_000_000;

// Pictures don't compress, so random bytes stand in for them.
const picture = (name, size = 2 * MB) => ({ name, data: randomBytes(size) });
const file = (bytes, name, type = '') => new File([bytes], name, { type, lastModified: MODIFIED });
const bytesOf = async (f) => Buffer.from(await f.arrayBuffer());
const entryNames = async (f) => listZipEntries(await bytesOf(f)).map((entry) => entry.name);

const SLIDES = [['Cell biology', 'The nucleus holds the DNA.'], ['Photosynthesis', 'Plants turn light into sugar.']];
const LINES = ['The mitochondria make energy for the cell.', 'Ribosomes build proteins.'];

describe('stripOfficeMedia', () => {
    test('a deck of pictures shrinks to a fraction and its slides read the same', async () => {
        const original = file(
            makePptx(SLIDES, { extra: [picture('ppt/media/image1.png'), picture('ppt/media/image2.jpeg'), picture('ppt/embeddings/oleObject1.bin'), picture('docProps/thumbnail.jpeg', 20_000)] }),
            'lecture.pptx',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        );
        const stripped = await stripOfficeMedia(original);

        expect(original.size).toBeGreaterThan(6 * MB);
        expect(stripped.size).toBeLessThan(original.size / 50);
        expect(await entryNames(stripped)).not.toContainEqual(expect.stringMatching(/media|embeddings|thumbnail/));
        expect(stripped).toMatchObject({ name: 'lecture.pptx', type: original.type, lastModified: MODIFIED });

        const before = extractPptxText(await bytesOf(original));
        const after = extractPptxText(await bytesOf(stripped));
        expect(after).toMatchObject({ text: before.text, slides: 2, chars: before.chars });
        expect(after.text).toContain('The nucleus holds the DNA.');
    });

    test('the stripped deck is still a PowerPoint file to the server', async () => {
        const stripped = await stripOfficeMedia(file(makePptx(SLIDES, { extra: [picture('ppt/media/image1.png')] }), 'a.pptx'));
        expect(detectFileType(await bytesOf(stripped), 'a.pptx')).toMatchObject({ ext: 'pptx' });
    });

    test('a Word file loses word/media and keeps its text and page count', async () => {
        const app = { name: 'docProps/app.xml', data: '<Properties><Pages>7</Pages></Properties>', deflate: true };
        const original = file(makeDocx(LINES, { extra: [app, picture('word/media/image1.png'), picture('word/media/image2.jpeg')] }), 'notes.docx');
        const stripped = await stripOfficeMedia(original);

        expect(stripped.size).toBeLessThan(original.size / 50);
        expect(await entryNames(stripped)).toEqual(['[Content_Types].xml', 'word/document.xml', 'docProps/app.xml']);
        expect(detectFileType(await bytesOf(stripped), 'notes.docx')).toMatchObject({ ext: 'docx' });
        const { text, pages } = extractDocxText(await bytesOf(stripped));
        expect(text).toBe(LINES.join('\n'));
        expect(pages).toBe(7);
    });

    test('a deck that is only pictures reads as too little text, as the server reports', async () => {
        const stripped = await stripOfficeMedia(file(makePptx([[], []], { extra: [picture('ppt/media/image1.png')] }), 'scans.pptx'));
        expect(extractPptxText(await bytesOf(stripped)).chars).toBeLessThan(MIN_SOURCE_CHARS);
    });

    test('a file that is not a valid zip is sent unchanged', async () => {
        const broken = file(randomBytes(5000), 'broken.pptx');
        expect(await stripOfficeMedia(broken)).toBe(broken);
        const truncated = file(makePptx(SLIDES, { extra: [picture('ppt/media/image1.png', 50_000)] }).subarray(0, 4000), 'cut.pptx');
        expect(await stripOfficeMedia(truncated)).toBe(truncated);
    });

    test('a file with no pictures to remove is sent unchanged', async () => {
        const plain = file(makeDocx(LINES), 'plain.docx');
        expect(await stripOfficeMedia(plain)).toBe(plain);
    });

    test('other file kinds are not opened', async () => {
        const pdf = file(Buffer.from('%PDF-1.4 not really'), 'book.pdf');
        expect(await stripOfficeMedia(pdf)).toBe(pdf);
        const xlsx = file(makeDocx(LINES, { extra: [picture('word/media/image1.png')] }), 'sheet.xlsx');
        expect(await stripOfficeMedia(xlsx)).toBe(xlsx);
    });
});

describe('shrinkPhoto', () => {
    test('a photo at or under the limit is left as it is', async () => {
        const small = file(makePng(), 'shot.png', 'image/png');
        expect(await shrinkPhoto(small)).toBe(small);
        const edge = file(Buffer.alloc(4 * MB), 'edge.jpg', 'image/jpeg');
        expect(await shrinkPhoto(edge)).toBe(edge);
    });

    test('a big file that is not a photo is left as it is', async () => {
        const pdf = file(Buffer.alloc(5 * MB), 'book.pdf', 'application/pdf');
        expect(await shrinkPhoto(pdf)).toBe(pdf);
    });

    test('a big photo the browser cannot decode comes back unchanged', async () => {
        // There is no image decoder here, which is the same as a browser failing on a damaged photo.
        const broken = file(Buffer.alloc(5 * MB), 'broken.jpg', 'image/jpeg');
        expect(await shrinkPhoto(broken)).toBe(broken);
    });
});

describe('prepareSources', () => {
    test('keeps the order, strips Word and PowerPoint, leaves the rest', async () => {
        const deck = file(makePptx(SLIDES, { extra: [picture('ppt/media/image1.png')] }), 'deck.pptx');
        const pdf = file(Buffer.from('%PDF-1.4 text'), 'a.pdf');
        const photo = file(makePng(), 'p.png', 'image/png');
        const notes = file(makeDocx(LINES, { extra: [picture('word/media/image1.png')] }), 'notes.docx');

        const prepared = await prepareSources([pdf, deck, photo, notes]);

        expect(prepared.map((f) => f.name)).toEqual(['a.pdf', 'deck.pptx', 'p.png', 'notes.docx']);
        expect(prepared[0]).toBe(pdf);
        expect(prepared[2]).toBe(photo);
        expect(prepared[1].size).toBeLessThan(deck.size / 50);
        expect(prepared[3].size).toBeLessThan(notes.size / 50);
    });

    test('nothing in, nothing out', async () => {
        expect(await prepareSources([])).toEqual([]);
    });
});
