import { ProgressBar } from "@/shared/ui";
import { NEAR_FULL, usageText } from "./fileNotice";

// "Your storage · 82 MB of 100 MB" with a bar. Accent until 80% and in the watch tone from there,
// full included: red is only for errors and delete. The bar eases to a new value when usage changes.
// It counts everything the student has stored, so the label isn't "Study files". With `fileCount` it
// is the Files page's meter (Figma 150:924): "Storage", "46 MB of 100 MB used · 14 files", and the
// bar beside it on a desktop.
export default function StorageMeter({ usage, fileCount }) {
  const share = usage.usedBytes / usage.limitBytes;
  const text = usageText(usage);
  const page = fileCount !== undefined;
  return (
    <div className={`files-meter${page ? " files-meter--page" : ""}`}>
      <p className="files-meter__text">
        <strong>{page ? "Storage" : "Your storage"}</strong>
        {page ? <span>{text} used · {fileCount} {fileCount === 1 ? "file" : "files"}</span> : ` · ${text}`}
      </p>
      <ProgressBar value={share} tone={share >= NEAR_FULL ? "watch" : "accent"} label="Your storage" valueText={`${text} used`} />
    </div>
  );
}
