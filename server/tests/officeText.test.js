import { describe, test, expect } from 'vitest';
import { extractDocxText, extractPptxText, MAX_DOCX_XML_BYTES, MAX_SLIDES } from '../utils/officeText.js';
import { MAX_SOURCE_CHARS } from '../utils/pdfText.js';
import { ZipError } from '../utils/zipEntries.js';
import { makeZip } from './helpers/fileFixtures.js';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const paragraph = (inner) => `<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr><w:r>${inner}</w:r></w:p>`;
const wordXml = (body) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}</w:body></w:document>`;
const docx = (body, extraEntries = []) => makeZip([
    '[Content_Types].xml',
    { name: 'word/document.xml', data: wordXml(body), deflate: true },
    ...extraEntries,
]);

const errorCode = (fn) => {
    try {
        fn();
    } catch (err) {
        expect(err).toBeInstanceOf(ZipError);
        return err.code;
    }
    throw new Error('expected a ZipError');
};

describe('extractDocxText', () => {
    test('paragraphs, tabs and line breaks', () => {
        const body = paragraph('<w:t>First paragraph.</w:t>')
            + paragraph('<w:t>Name</w:t><w:tab/><w:t>Value</w:t>')
            + paragraph('<w:t xml:space="preserve">Line one</w:t><w:br/><w:t>Line two</w:t>');
        const result = extractDocxText(docx(body));
        expect(result.text).toBe('First paragraph.\nName Value\nLine one\nLine two');
        expect(result).toMatchObject({ pages: null, slides: null, chars: result.text.length, truncated: false });
    });

    test('runs inside a paragraph join without a break', () => {
        expect(extractDocxText(docx('<w:p><w:r><w:t>Photo</w:t></w:r><w:r><w:t>synthesis</w:t></w:r></w:p>')).text).toBe('Photosynthesis');
    });

    test('tab stop definitions are not tabs', () => {
        const body = '<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr><w:r><w:t>Indented</w:t></w:r></w:p>';
        expect(extractDocxText(docx(body)).text).toBe('Indented');
    });

    test('entities, including numeric ones, and invalid code points are skipped', () => {
        const body = paragraph('<w:t>Salt &amp; pepper &lt;b&gt; &quot;caf&#233;&quot; &apos;ok&apos; &#x1F600; [&#xFFFFFFF;] [&#xD800;]</w:t>');
        expect(extractDocxText(docx(body)).text).toBe('Salt & pepper <b> "café" \'ok\' \u{1F600} [] []');
    });

    test('unknown entities stay as written', () => {
        expect(extractDocxText(docx(paragraph('<w:t>a &nbsp; b</w:t>'))).text).toBe('a &nbsp; b');
    });

    test('Filipino text', () => {
        const body = paragraph('<w:t>Ang mga mag-aaral ay nag-aaral ng Kasaysayan ng Pilipinas.</w:t>')
            + paragraph('<w:t>Ñino, señor at Parañaque.</w:t>');
        expect(extractDocxText(docx(body)).text).toBe('Ang mga mag-aaral ay nag-aaral ng Kasaysayan ng Pilipinas.\nÑino, señor at Parañaque.');
    });

    test('deleted text and field codes are left out', () => {
        const body = '<w:p><w:del><w:r><w:delText>old words</w:delText></w:r></w:del>'
            + '<w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:t>kept words</w:t></w:r></w:p>';
        expect(extractDocxText(docx(body)).text).toBe('kept words');
    });

    test('table cells land on separate lines', () => {
        const cell = (text) => `<w:tc><w:tcPr/><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
        const body = `<w:tbl><w:tr>${cell('Term')}${cell('Meaning')}</w:tr><w:tr>${cell('Osmosis')}${cell('Water moving')}</w:tr></w:tbl>`;
        expect(extractDocxText(docx(body)).text).toBe('Term\nMeaning\nOsmosis\nWater moving');
    });

    test('the fallback copy of a text box is not read twice', () => {
        const box = (text) => `<w:txbxContent><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:txbxContent>`;
        const body = `<w:p><w:r><mc:AlternateContent><mc:Choice Requires="wps">${box('Boxed note')}</mc:Choice>`
            + `<mc:Fallback>${box('Boxed note')}</mc:Fallback></mc:AlternateContent></w:r></w:p>`;
        expect(extractDocxText(docx(body)).text).toBe('Boxed note');
    });

    test('a stray "<" does not break the rest', () => {
        expect(extractDocxText(docx(`${paragraph('<w:t>before</w:t>')}<<<${paragraph('<w:t>after</w:t>')}`)).text).toBe('before\nafter');
    });

    test('no word/document.xml, or two of them, is damaged', () => {
        expect(errorCode(() => extractDocxText(makeZip(['[Content_Types].xml', 'word/styles.xml'])))).toBe('damaged');
        const twice = docx(paragraph('<w:t>one</w:t>'), [{ name: 'word/document.xml', data: wordXml(paragraph('<w:t>two</w:t>')) }]);
        expect(errorCode(() => extractDocxText(twice))).toBe('damaged');
    });

    test('not a ZIP is damaged', () => {
        expect(errorCode(() => extractDocxText(Buffer.from('plain text pretending')))).toBe('damaged');
    });

    test('an encrypted body is refused', () => {
        const zip = makeZip([{ name: 'word/document.xml', data: wordXml(''), flags: 0x0001 }]);
        expect(errorCode(() => extractDocxText(zip))).toBe('encrypted');
    });

    test('a body over the cap is too big', () => {
        const huge = makeZip([{ name: 'word/document.xml', data: Buffer.alloc(MAX_DOCX_XML_BYTES + 1, 0x20), deflate: true }]);
        expect(errorCode(() => extractDocxText(huge))).toBe('too_big');
    });

    test('text over the source limit is cut and marked', () => {
        const long = 'a'.repeat(1000);
        const body = Array.from({ length: 400 }, () => paragraph(`<w:t>${long}</w:t>`)).join('');
        const result = extractDocxText(docx(body));
        expect(result.text).toHaveLength(MAX_SOURCE_CHARS);
        expect(result.chars).toBeGreaterThan(MAX_SOURCE_CHARS);
        expect(result.truncated).toBe(true);
    });

    test('reports what it unpacked, and a lower cap from the caller is kept', () => {
        const file = docx(paragraph('<w:t>Some words.</w:t>'));
        const { unpacked } = extractDocxText(file);
        expect(unpacked).toBe(Buffer.byteLength(wordXml(paragraph('<w:t>Some words.</w:t>'))));
        expect(extractDocxText(file, { maxBytes: unpacked }).text).toBe('Some words.');
        expect(errorCode(() => extractDocxText(file, { maxBytes: unpacked - 1 }))).toBe('too_big');
    });
});

const P ='xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const shape = (...lines) => `<p:sp><p:txBody>${lines.map((line) => `<a:p><a:r><a:t>${line}</a:t></a:r></a:p>`).join('')}</p:txBody></p:sp>`;
const slideXml = (lines, { hidden = false } = {}) => `<?xml version="1.0"?><p:sld ${P}${hidden ? ' show="0"' : ''}><p:cSld><p:spTree>${shape(...lines)}</p:spTree></p:cSld></p:sld>`;
const notesXml = (text) => `<p:notes ${P}><p:cSld><p:spTree>${shape(text)}${shape('7')}</p:spTree></p:cSld></p:notes>`;
const rels = (targets) => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${
    Object.entries(targets).map(([id, target]) => `<Relationship Id="${id}" Type="t" Target="${target}"/>`).join('')}</Relationships>`;
const presentationXml = (ids) => `<p:presentation ${P}><p:sldMasterIdLst><p:sldMasterId id="1" r:id="rId1"/></p:sldMasterIdLst>`
    + `<p:sldIdLst>${ids.map((id, i) => `<p:sldId id="${256 + i}" r:id="${id}"/>`).join('')}</p:sldIdLst></p:presentation>`;

// entries: { 'ppt/slides/slide1.xml': xml, ... }; every one is deflated.
const pptx = (entries) => makeZip(['[Content_Types].xml', ...Object.entries(entries).map(([name, data]) => ({ name, data, deflate: true }))]);

describe('extractPptxText', () => {
    test('slides follow the order in presentation.xml, with notes after each', () => {
        const zip = pptx({
            'ppt/presentation.xml': presentationXml(['rId3', 'rId2']),
            'ppt/_rels/presentation.xml.rels': rels({ rId1: 'slideMasters/slideMaster1.xml', rId2: 'slides/slide1.xml', rId3: '/ppt/slides/slide2.xml' }),
            'ppt/slides/slide1.xml': slideXml(['Cell parts', 'Nucleus']),
            'ppt/slides/slide2.xml': slideXml(['Introduction']),
            'ppt/slides/_rels/slide1.xml.rels': rels({ rId1: '../slideLayouts/slideLayout1.xml', rId2: '../notesSlides/notesSlide4.xml' }),
            'ppt/notesSlides/notesSlide4.xml': notesXml('Say the nucleus holds DNA.'),
        });
        const result = extractPptxText(zip);
        expect(result.text).toBe('Slide 1\nIntroduction\n\nSlide 2\nCell parts\nNucleus\nNotes:\nSay the nucleus holds DNA.');
        expect(result).toMatchObject({ pages: null, slides: 2, truncated: false });
    });

    test('line breaks inside a paragraph', () => {
        const slide = `<p:sld ${P}><p:txBody><a:p><a:r><a:t>Top</a:t></a:r><a:br/><a:r><a:t>Bottom</a:t></a:r></a:p></p:txBody></p:sld>`;
        expect(extractPptxText(pptx({ 'ppt/slides/slide1.xml': slide })).text).toBe('Slide 1\nTop\nBottom');
    });

    test('a hidden slide is left out but keeps its number', () => {
        const zip = pptx({
            'ppt/slides/slide1.xml': slideXml(['Shown first']),
            'ppt/slides/slide2.xml': slideXml(['Secret answers'], { hidden: true }),
            'ppt/slides/slide3.xml': slideXml(['Shown last']),
        });
        const result = extractPptxText(zip);
        expect(result.text).toBe('Slide 1\nShown first\n\nSlide 3\nShown last');
        expect(result.text).not.toContain('Secret');
        expect(result.slides).toBe(3);
    });

    test('without presentation.xml, slides go by number', () => {
        const zip = pptx({
            'ppt/slides/slide10.xml': slideXml(['Ten']),
            'ppt/slides/slide2.xml': slideXml(['Two']),
            'ppt/slides/slide1.xml': slideXml(['One']),
        });
        expect(extractPptxText(zip).text).toBe('Slide 1\nOne\n\nSlide 2\nTwo\n\nSlide 3\nTen');
    });

    test('targets outside the slides folder or the package are ignored', () => {
        const zip = pptx({
            'ppt/presentation.xml': presentationXml(['rId2', 'rId3', 'rId4']),
            'ppt/_rels/presentation.xml.rels': rels({ rId2: '../../etc/x.xml', rId3: '../word/document.xml', rId4: 'slides/slide1.xml' }),
            'ppt/slides/slide1.xml': slideXml(['Real slide']),
            'ppt/slides/_rels/slide1.xml.rels': rels({ rId1: '../../../etc/notes.xml' }),
            'word/document.xml': slideXml(['Not a slide']),
            'etc/x.xml': slideXml(['Not a slide either']),
        });
        const result = extractPptxText(zip);
        expect(result.text).toBe('Slide 1\nReal slide');
        expect(result.slides).toBe(1);
    });

    test('when no listed slide resolves, slides go by number', () => {
        const zip = pptx({
            'ppt/presentation.xml': presentationXml(['rId2']),
            'ppt/_rels/presentation.xml.rels': rels({ rId2: '../../etc/x.xml' }),
            'ppt/slides/slide1.xml': slideXml(['Found anyway']),
        });
        expect(extractPptxText(zip).text).toBe('Slide 1\nFound anyway');
    });

    test(`only the first ${MAX_SLIDES} slides are read`, () => {
        const entries = {};
        for (let n = 1; n <= MAX_SLIDES + 1; n += 1) entries[`ppt/slides/slide${n}.xml`] = slideXml([`Topic ${n}`]);
        const result = extractPptxText(pptx(entries));
        expect(result.slides).toBe(MAX_SLIDES + 1);
        expect(result.truncated).toBe(true);
        expect(result.text).toContain(`Slide ${MAX_SLIDES}\nTopic ${MAX_SLIDES}`);
        expect(result.text).not.toContain(`Topic ${MAX_SLIDES + 1}`);
    });

    test('text over the source limit is cut and marked', () => {
        const entries = {};
        for (let n = 1; n <= 4; n += 1) entries[`ppt/slides/slide${n}.xml`] = slideXml(['b'.repeat(100_000)]);
        const result = extractPptxText(pptx(entries));
        expect(result.text).toHaveLength(MAX_SOURCE_CHARS);
        expect(result.chars).toBeGreaterThan(MAX_SOURCE_CHARS);
        expect(result.truncated).toBe(true);
        expect(result.slides).toBe(4);
    });

    test('a slide listed twice in the ZIP is damaged', () => {
        const zip = makeZip([
            { name: 'ppt/slides/slide1.xml', data: slideXml(['one']) },
            { name: 'ppt/slides/slide1.xml', data: slideXml(['two']) },
        ]);
        expect(errorCode(() => extractPptxText(zip))).toBe('damaged');
    });

    test('a deck with no slides has no text', () => {
        expect(extractPptxText(pptx({ 'ppt/presentation.xml': presentationXml([]) }))).toMatchObject({ text: '', slides: 0, truncated: false });
    });
});
