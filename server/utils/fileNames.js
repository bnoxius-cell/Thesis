// Student-supplied file names are never trusted: they are cleaned before they are stored or shown, and
// the Content-Disposition value built here is saved with the object, so it must be plain ASCII.

const MAX_BASE_LENGTH = 120;
const FALLBACK_BASE = 'file';

// Control characters, invisible and bidi marks (they can fake an extension, like a right-to-left override),
// line separators, and the characters that mean something in a path or a header.
const UNSAFE_CHARS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}/\\:*?"<>|]/gu;
const TRAILING_EXTENSION = /\.[A-Za-z][A-Za-z0-9]{0,7}$/;
const EDGE_DOTS_AND_SPACES = /^[\s.]+|[\s.]+$/g;

const asText = (value) => (typeof value === 'string' ? value : '');
const stripUnsafe = (text) => text.toWellFormed().normalize('NFC').replace(UNSAFE_CHARS, '');

// Lower-case extension without the dot, or '' when the name has none.
export const extensionOf = (name) => /\.([A-Za-z0-9]+)$/.exec(asText(name))?.[1].toLowerCase() ?? '';

// Keeps the student's base name and forces the detected type's extension on, so "notes.pdf.exe" can't exist.
export const cleanFileName = (name, ext) => {
    const lastSegment = asText(name).split(/[\\/]/).pop();
    let base = stripUnsafe(lastSegment).trim().replace(/[\s.]+$/, '').replace(TRAILING_EXTENSION, '');
    if (base.toLowerCase().endsWith(`.${ext}`)) base = base.slice(0, -(ext.length + 1));
    base = Array.from(base.replace(EDGE_DOTS_AND_SPACES, '')).slice(0, MAX_BASE_LENGTH).join('');
    return `${base.replace(EDGE_DOTS_AND_SPACES, '') || FALLBACK_BASE}.${ext}`;
};

// attr-char in RFC 8187: encodeURIComponent leaves ' ( ) * alone, so those are escaped by hand.
const encodeAttrValue = (text) => encodeURIComponent(text)
    .replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

// An ASCII fallback for old clients plus the real name in filename*. The result is pure ASCII with no
// CR or LF, because it is sent to R2 as a signed request header.
export const contentDisposition = (name, { inline = false } = {}) => {
    const clean = stripUnsafe(asText(name)) || FALLBACK_BASE;
    const fallback = clean.replace(/[^\x20-\x7e]|%/g, '_');
    return `${inline ? 'inline' : 'attachment'}; filename="${fallback}"; filename*=UTF-8''${encodeAttrValue(clean)}`;
};
