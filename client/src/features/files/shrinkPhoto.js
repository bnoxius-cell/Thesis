// Makes a big phone photo smaller before it is sent (plan 27, 4): the longest side at most 2,400 px,
// JPEG at 0.85, which stays sharp enough to read and usually lands under 1.5 MB. Smaller photos, and
// anything that isn't a photo, are left exactly as they are. Like makeThumb, any failure answers the
// original, so it never stops an upload.
import { extensionOf, isPhoto } from "./fileRules.js";

const LONGEST_SIDE = 2400;
const QUALITY = 0.85;
export const SHRINK_ABOVE_BYTES = 4 * 1024 * 1024;

const toJpeg = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
const jpgName = (name) => `${name.slice(0, name.length - extensionOf(name).length - 1)}.jpg`;

// A smaller JPEG File with the same name (ending in .jpg), or `file` itself when it is under
// `minBytes`, isn't a photo, can't be decoded or wouldn't get any smaller.
export default async function shrinkPhoto(file, { minBytes = SHRINK_ABOVE_BYTES } = {}) {
  if (file.size <= minBytes || !isPhoto(extensionOf(file.name))) return file;
  let bitmap = null;
  try {
    // "from-image" applies the photo's rotation, so a portrait shot isn't sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, LONGEST_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff"; // JPEG has no transparency: a see-through PNG would turn black
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await toJpeg(canvas);
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], jpgName(file.name), { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
