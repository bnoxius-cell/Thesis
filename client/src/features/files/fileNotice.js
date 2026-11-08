import { Info, Pause } from "lucide-react";
import { formatSize } from "@/shared/lib/formatSize";
import { MAX_LIBRARY_FILES } from "./fileRules";

// "December 1", the way the server words it (Philippine time).
const monthDay = (iso) =>
  new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "Asia/Manila" }).format(new Date(iso));

export const NEAR_FULL = 0.8;

// "46 MB of 100 MB": how much of the student's space is used.
export const usageText = ({ usedBytes, limitBytes }) => `${formatSize(usedBytes)} of ${formatSize(limitBytes)}`;

// Why the student can't upload right now, or null when they can. `uploads` is what the list said
// about the server's side ({ on, code, message, resumesAt }), `usage` the student's own space.
// `fileCount` is how many files they have in all, given only where every file is loaded (the Files
// page). The text is the approved wording of Figma 160:2121 and 160:2452; there is no upgrade or
// payment line anywhere.
export function uploadBlock({ uploads, usage }, fileCount) {
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
  if (fileCount >= MAX_LIBRARY_FILES) {
    return { icon: Info, message: `You have ${MAX_LIBRARY_FILES} files. Delete some to add more.` };
  }
  return null;
}
