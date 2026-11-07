// Pulls the text out of Word (.docx) and PowerPoint (.pptx) files, the way pdfText.js does for PDFs.
// The XML is scanned with simple linear patterns, never a real parser: no DTD, no entity expansion
// beyond the five named entities and numeric references, so a crafted file can't make it blow up.
// Throws a ZipError ('damaged', 'encrypted', 'too_big') when the file can't be read.

import { cleanPageText, MAX_SOURCE_CHARS } from './pdfText.js';
import { listZipEntries, readZipEntry, ZipError } from './zipEntries.js';

const MB = 1024 * 1024;
export const MAX_DOCX_XML_BYTES = 25 * MB;
export const MAX_SLIDES = 300;
export const MAX_PPTX_PART_BYTES = 5 * MB;
export const MAX_PPTX_TOTAL_BYTES = 40 * MB;

const DOCUMENT_ENTRY = 'word/document.xml';
const PRESENTATION_ENTRY = 'ppt/presentation.xml';
const PRESENTATION_RELS_ENTRY = 'ppt/_rels/presentation.xml.rels';
const SLIDE_ENTRY = /^ppt\/slides\/slide(\d+)\.xml$/;
const NOTES_ENTRY = /^ppt\/notesSlides\/notesSlide\d+\.xml$/;

// Which elements hold text, end a paragraph or break a line. Word marks tabs with an element;
// inside <w:tabs> the same element only defines tab stops.
const WORD = { text: 'w:t', paragraph: 'w:p', lineBreaks: ['w:br', 'w:cr'], tab: 'w:tab', tabStops: 'w:tabs' };
const DRAWING = { text: 'a:t', paragraph: 'a:p', lineBreaks: ['a:br'] };
// Office repeats some content (text boxes, newer shapes) as a fallback copy for older readers.
const FALLBACK = 'mc:Fallback';

// A tag (group 1, without the brackets) or a run of text (group 2). `[^<>]` keeps a stray "<" from
// making the scan go back over the rest of the file, so it stays linear.
const TOKEN = /<([^<>]*)>|([^<]+)/g;
const TAG_NAME = /^\/?([^\s/]+)/;
const SLIDE_ID_TAG = /<p:sldId\b([^<>]*)>/g;
const RELATIONSHIP_TAG = /<Relationship\b([^<>]*)>/g;
const SLIDE_ROOT_TAG = /<p:sld\b([^<>]*)>/;

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const ENTITY = /&(?:#(\d+)|#x([0-9a-fA-F]+)|(amp|lt|gt|quot|apos));/g;

// The characters XML allows; anything else (surrogates, most control codes, past U+10FFFF) is dropped.
const isXmlChar = (code) => code === 0x9 || code === 0xa || code === 0xd
    || (code >= 0x20 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) || (code >= 0x10000 && code <= 0x10ffff);

const decodeEntities = (text) => text.replace(ENTITY, (_, decimal, hex, named) => {
    if (named) return NAMED_ENTITIES[named];
    const code = decimal ? Number(decimal) : parseInt(hex, 16);
    return isXmlChar(code) ? String.fromCodePoint(code) : '';
});

const attribute = (tag, name) => {
    const found = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(tag);
    return found ? decodeEntities(found[1] ?? found[2]) : null;
};

// Opens one level deeper on an opening tag, one shallower on a closing one; empty tags change nothing.
const nest = (depth, closing, empty) => (empty ? depth : Math.max(0, depth + (closing ? -1 : 1)));

// The readable text of a WordprocessingML or DrawingML part, one paragraph per line.
const partText = (xml, markup) => {
    const pieces = [];
    let inText = false;
    let fallbackDepth = 0;
    let tabStopDepth = 0;
    for (const [, tag, text] of xml.matchAll(TOKEN)) {
        if (text !== undefined) {
            if (inText && fallbackDepth === 0) pieces.push(decodeEntities(text));
            continue;
        }
        const name = TAG_NAME.exec(tag)?.[1];
        const closing = tag.startsWith('/');
        const empty = tag.endsWith('/');
        if (name === FALLBACK) fallbackDepth = nest(fallbackDepth, closing, empty);
        else if (fallbackDepth > 0) continue;
        else if (name === markup.text) inText = !closing && !empty;
        else if (name === markup.paragraph && (closing || empty)) pieces.push('\n');
        else if (markup.lineBreaks.includes(name) && !closing) pieces.push('\n');
        else if (name === markup.tabStops) tabStopDepth = nest(tabStopDepth, closing, empty);
        else if (name === markup.tab && !closing && tabStopDepth === 0) pieces.push('\t');
    }
    return pieces.join('');
};

// The package's entries by name, read as UTF-8 text against one shared byte budget. A name listed twice
// is "damaged" once we need it: there's no telling which copy is the real one.
const openPackage = (buffer, totalBytes) => {
    const entries = listZipEntries(buffer);
    if (!entries) throw new ZipError('damaged');
    const byName = new Map();
    const duplicates = new Set();
    for (const entry of entries) {
        if (byName.has(entry.name)) duplicates.add(entry.name);
        else byName.set(entry.name, entry);
    }
    let budget = totalBytes;
    return {
        names: () => [...byName.keys()],
        has: (name) => byName.has(name),
        // The entry's text, or null when there's no such entry.
        readText(name, maxBytes) {
            if (duplicates.has(name)) throw new ZipError('damaged');
            const entry = byName.get(name);
            if (!entry) return null;
            if (budget < 1) throw new ZipError('too_big');
            const data = readZipEntry(buffer, entry, { maxBytes: Math.min(maxBytes, budget) });
            budget -= data.length;
            return data.toString('utf8');
        },
    };
};

// The part a relationship target points at, from the folder of the part that owns the .rels, or null
// when it climbs out of the package. The result is only ever looked up in the entry list.
const resolvePart = (folder, target) => {
    const path = target.startsWith('/') ? target.slice(1) : folder + target;
    const segments = [];
    for (const segment of path.split('/')) {
        if (segment === '..') {
            if (!segments.length) return null;
            segments.pop();
        } else if (segment && segment !== '.') {
            segments.push(segment);
        }
    }
    return segments.join('/');
};

const relationshipTargets = (relsXml) => {
    const targets = new Map();
    for (const [, tag] of relsXml.matchAll(RELATIONSHIP_TAG)) {
        const id = attribute(tag, 'Id');
        const target = attribute(tag, 'Target');
        if (id && target && attribute(tag, 'TargetMode') !== 'External') targets.set(id, target);
    }
    return targets;
};

// Slides in show order, from presentation.xml through its relationships.
const presentationSlides = (pkg) => {
    const presentation = pkg.readText(PRESENTATION_ENTRY, MAX_PPTX_PART_BYTES);
    const rels = presentation && pkg.readText(PRESENTATION_RELS_ENTRY, MAX_PPTX_PART_BYTES);
    if (!rels) return [];
    const targets = relationshipTargets(rels);
    const slides = new Set();
    for (const [, tag] of presentation.matchAll(SLIDE_ID_TAG)) {
        const target = targets.get(attribute(tag, 'r:id'));
        const part = target && resolvePart('ppt/', target);
        if (part && SLIDE_ENTRY.test(part) && pkg.has(part)) slides.add(part);
    }
    return [...slides];
};

const slidesByNumber = (pkg) => pkg.names()
    .map((name) => ({ name, number: SLIDE_ENTRY.exec(name)?.[1] }))
    .filter((slide) => slide.number)
    .sort((a, b) => Number(a.number) - Number(b.number))
    .map((slide) => slide.name);

const slideOrder = (pkg) => {
    const listed = presentationSlides(pkg);
    return listed.length ? listed : slidesByNumber(pkg);
};

const notesPartOf = (pkg, slidePart) => {
    const fileName = slidePart.slice(slidePart.lastIndexOf('/') + 1);
    const rels = pkg.readText(`ppt/slides/_rels/${fileName}.rels`, MAX_PPTX_PART_BYTES);
    if (!rels) return null;
    for (const target of relationshipTargets(rels).values()) {
        const part = resolvePart('ppt/slides/', target);
        if (part && NOTES_ENTRY.test(part) && pkg.has(part)) return part;
    }
    return null;
};

const isHidden = (slideXml) => {
    const root = SLIDE_ROOT_TAG.exec(slideXml);
    return Boolean(root) && ['0', 'false'].includes(attribute(root[1], 'show'));
};

// "Slide N", the slide's text, then its speaker notes; null for a hidden or empty slide.
const slideBlock = (pkg, slidePart, number) => {
    const xml = pkg.readText(slidePart, MAX_PPTX_PART_BYTES);
    if (isHidden(xml)) return null;
    const body = cleanPageText(partText(xml, DRAWING));
    const notesPart = notesPartOf(pkg, slidePart);
    const notes = notesPart ? cleanPageText(partText(pkg.readText(notesPart, MAX_PPTX_PART_BYTES), DRAWING)) : '';
    if (!body && !notes) return null;
    return [`Slide ${number}`, body, notes && `Notes:\n${notes}`].filter(Boolean).join('\n');
};

// Same shape as extractPdfText. Word and PowerPoint have no fixed pages, so `pages` is null.
const sourceText = (full, { slides = null, truncated = false } = {}) => {
    const cut = full.length > MAX_SOURCE_CHARS;
    return {
        text: cut ? full.slice(0, MAX_SOURCE_CHARS) : full,
        pages: null,
        slides,
        chars: full.length,
        truncated: cut || truncated,
    };
};

// The document body only: headers, footers, footnotes and comments live in other parts and are skipped.
export const extractDocxText = (buffer) => {
    const pkg = openPackage(buffer, MAX_DOCX_XML_BYTES);
    const xml = pkg.readText(DOCUMENT_ENTRY, MAX_DOCX_XML_BYTES);
    if (xml === null) throw new ZipError('damaged');
    return sourceText(cleanPageText(partText(xml, WORD)));
};

// Slides in show order with their notes. `slides` counts every slide in the deck; only the first
// MAX_SLIDES are read, and hidden ones are left out.
export const extractPptxText = (buffer) => {
    const pkg = openPackage(buffer, MAX_PPTX_TOTAL_BYTES);
    const slides = slideOrder(pkg);
    const blocks = slides.slice(0, MAX_SLIDES).map((part, i) => slideBlock(pkg, part, i + 1)).filter(Boolean);
    return sourceText(blocks.join('\n\n'), { slides: slides.length, truncated: slides.length > MAX_SLIDES });
};
