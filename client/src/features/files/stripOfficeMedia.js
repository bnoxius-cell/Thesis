// Makes a Word or PowerPoint file small enough to send for a reviewer (plan 27, 4). The files are ZIPs
// and mostly pictures, and the server only reads their text, so the pictures, embedded objects and the
// preview thumbnail are left out. Every other entry keeps its content, so the server reads the same
// text. Only for files sent to make a reviewer: the stored Study copy is never changed, because
// students download that one.
import { unzipSync, zipSync } from "fflate";
import { extensionOf } from "./fileRules.js";

const OFFICE_EXTS = new Set(["docx", "pptx"]);
const LEFT_OUT = /^(?:ppt|word)\/(?:media|embeddings)\/|^docProps\/thumbnail\./i;

// The same File without its pictures. The original comes back when it isn't a Word or PowerPoint file,
// can't be unzipped, or would not get any smaller, so a failure here never stops a reviewer.
export default async function stripOfficeMedia(file) {
  if (!OFFICE_EXTS.has(extensionOf(file.name))) return file;
  try {
    const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: (entry) => !LEFT_OUT.test(entry.name) });
    const stripped = zipSync(entries);
    if (stripped.length >= file.size) return file;
    return new File([stripped], file.name, { type: file.type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}
