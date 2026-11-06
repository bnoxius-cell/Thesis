// The small preview sent with a photo (plan 19, 3.2): the longest side 320 px, JPEG, under the
// server's 100 KiB limit. A photo without a preview still uploads and shows an image icon, so any
// failure here answers null and never stops the upload.

const LONGEST_SIDE = 320;
const MAX_BYTES = 100 * 1024;
const QUALITIES = [0.7, 0.5];

const toJpeg = (canvas, quality) => new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

// A Blob, or null when the browser can't decode the photo or it won't fit under the limit.
export default async function makeThumb(file) {
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

    for (const quality of QUALITIES) {
      const blob = await toJpeg(canvas, quality);
      if (blob && blob.size <= MAX_BYTES) return blob;
    }
    return null;
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}
