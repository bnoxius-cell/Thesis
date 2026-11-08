// What the file viewer may show for a stored file (plan 23). Pure, so the server tests can check it.
// The kind comes from the file's own extension, never from what the storage answers, and only a PDF
// whose bytes really start with "%PDF-" is ever handed to the browser as a PDF.

export const PDF_TYPE = "application/pdf";
export const TEXT_PREVIEW_CHARS = 200_000;

const VIEW_KINDS = {
  pdf: "pdf",
  txt: "text",
  md: "text",
  markdown: "text",
  png: "photo",
  jpg: "photo",
  jpeg: "photo",
  webp: "photo",
};

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

// "photo", "pdf", "text", or "none" for a file the viewer can't show (Word, PowerPoint, Excel, unknown).
export function viewKindOf(ext) {
  const key = String(ext ?? "").toLowerCase();
  return Object.hasOwn(VIEW_KINDS, key) ? VIEW_KINDS[key] : "none";
}

// True when the first bytes (a Uint8Array) are a PDF header.
export const looksLikePdf = (bytes) => bytes.length >= PDF_MAGIC.length && PDF_MAGIC.every((byte, at) => bytes[at] === byte);

// A long text file shows its first part; `cut` says some was left out.
export function previewText(text) {
  if (text.length <= TEXT_PREVIEW_CHARS) return { text, cut: false };
  return { text: text.slice(0, TEXT_PREVIEW_CHARS), cut: true };
}
