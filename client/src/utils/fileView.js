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

// --- The Blob loader's decisions (client/src/shared/lib/fileBlobs.js) ---

export const MAX_BLOBS = 5;
export const MAX_BLOB_BYTES = 30 * 1024 * 1024;

// The code of a load whose bytes arrived but can't be shown: trying again would fetch the same bytes.
export const UNSHOWABLE = "unshowable";

const BLOB_TYPES = { pdf: PDF_TYPE, text: "text/plain" };

// A Blob's type, from the file's own extension only.
export const blobTypeOf = (ext) => BLOB_TYPES[viewKindOf(ext)] ?? "application/octet-stream";

// True when the bytes (a Uint8Array) are the file the list describes and safe to show as its kind:
// the size matches the row's, and a PDF starts "%PDF-".
export const bytesFit = ({ ext, size }, bytes) =>
  bytes.length === size && (viewKindOf(ext) !== "pdf" || looksLikePdf(bytes));

// What to do with a storage answer's HTTP status: "read" the body, "retry" once with a fresh link (a
// 403 is a link that ran out on the way; only seen if the storage ever sends CORS on error answers,
// otherwise fetch throws first), or "fail".
export function statusStep(status, retried) {
  if (status >= 200 && status < 300) return "read";
  return status === 403 && !retried ? "retry" : "fail";
}

// The ids to drop so the kept Blobs fit the limits, oldest first. `kept` is [[id, size]], oldest first.
export function blobsToDrop(kept, { maxCount = MAX_BLOBS, maxBytes = MAX_BLOB_BYTES } = {}) {
  let count = kept.length;
  let total = kept.reduce((sum, [, size]) => sum + size, 0);
  const drop = [];
  for (const [id, size] of kept) {
    if (count <= maxCount && total <= maxBytes) break;
    drop.push(id);
    count -= 1;
    total -= size;
  }
  return drop;
}
