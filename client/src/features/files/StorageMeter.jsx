import { ProgressBar } from "@/shared/ui";
import { formatSize } from "@/shared/lib/formatSize";
import { NEAR_FULL } from "./fileNotice";

// "Your storage · 82 MB of 100 MB" with a bar. Accent until 80% and in the watch tone from there,
// full included: red is only for errors and delete. The bar eases to a new value when usage changes.
// It counts everything the student has stored, so the label isn't "Study files".
export default function StorageMeter({ usage }) {
  const share = usage.usedBytes / usage.limitBytes;
  const text = `${formatSize(usage.usedBytes)} of ${formatSize(usage.limitBytes)}`;
  return (
    <div className="files-meter">
      <p className="files-meter__text">
        <strong>Your storage</strong> · {text}
      </p>
      <ProgressBar value={share} tone={share >= NEAR_FULL ? "watch" : "accent"} label="Your storage" valueText={`${text} used`} />
    </div>
  );
}
