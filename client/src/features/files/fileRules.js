import { formatSize } from "./fileKinds";

// What the picker offers and what is checked before sending, only so a student hears about a
// problem at once. The server checks every one of these again from the file's bytes and decides.

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PICK = 10; // files added in one go
const EXTENSIONS = ["pdf", "docx", "pptx", "xlsx", "txt", "md", "markdown", "png", "jpg", "jpeg", "webp"];

// For <input accept>: phones convert other photo formats to JPEG when the type is listed.
export const FILE_ACCEPT = [...EXTENSIONS.map((ext) => `.${ext}`), "image/jpeg", "image/png", "image/webp"].join(",");

// The same wording as the server's answers (utils/fileBudget.js).
const TOO_BIG = `That file is too big. The limit is ${formatSize(MAX_FILE_BYTES)}.`;
const BAD_TYPE = "This kind of file can't be sent. Try a photo, PDF, Word, PowerPoint, Excel or text file.";

export const extensionOf = (name) => name.split(".").pop().toLowerCase();

// A plain message when the file can't be sent, or "" when it can be tried.
export function fileProblem(file) {
  if (!EXTENSIONS.includes(extensionOf(file.name))) return BAD_TYPE;
  return file.size > MAX_FILE_BYTES ? TOO_BIG : "";
}
