import { Info, Pause } from "lucide-react";

// "December 1", the way the server words it (Philippine time).
const monthDay = (iso) =>
  new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "Asia/Manila" }).format(new Date(iso));

export const NEAR_FULL = 0.8;

// Why the student can't upload right now, or null when they can. `uploads` is what the list said
// about the server's side ({ on, code, message, resumesAt }), `usage` the student's own space.
// The text is the approved wording of Figma 160:2121 and 160:2452; there is no upgrade or payment
// line anywhere.
export function uploadBlock({ uploads, usage }) {
  if (uploads && !uploads.on) {
    if (uploads.code === "files_paused" && uploads.resumesAt) {
      return {
        icon: Pause,
        message: `File uploads are paused until ${monthDay(uploads.resumesAt)} so StressCare stays free. You can still open and download your files.`,
      };
    }
    return { icon: Info, message: uploads.message };
  }
  if (usage && usage.usedBytes >= usage.limitBytes) {
    return { icon: Info, message: "Your storage is full. Delete a file or move one out of StressCare to upload more." };
  }
  return null;
}
