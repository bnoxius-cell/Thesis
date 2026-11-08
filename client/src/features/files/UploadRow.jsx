import { Check, X } from "lucide-react";
import { Button, IconButton, ProgressBar } from "@/shared/ui";
import { formatSize } from "@/shared/lib/formatSize";
import { fileKind } from "./fileKinds";

function metaText({ status, size, progress, error }) {
  switch (status) {
    case "queued":
      return `${formatSize(size)} · Waiting`;
    case "uploading":
      return progress < 1 ? `${formatSize(progress * size)} of ${formatSize(size)}` : `${formatSize(size)} · Saving`;
    case "done":
      return `${formatSize(size)} · Uploaded`;
    case "failed":
    case "problem":
      return error;
    default:
      return formatSize(size);
  }
}

// One file in the Upload dialog (Figma 189:4329): its kind, name, size or progress, and a button for
// what can be done with it now.
//   status    "picked" | "problem" (not sent yet; `error` says why a problem can't be) | "queued" |
//             "uploading" | "done" | "failed"
//   progress  0 to 1 while uploading
//   onRemove  takes a picked or failed row out, or cancels a queued or running upload
//   onRetry   sends a failed row again (only when `retryable`)
export default function UploadRow({ name, ext, size, status, progress = 0, error = "", retryable = false, onRemove, onRetry }) {
  const { Icon } = fileKind(ext);
  const unsent = status === "picked" || status === "problem"; // in the dialog only, not in the queue
  const failed = status === "failed";
  const sending = status === "uploading" && progress < 1;
  const cancellable = status === "queued" || sending;
  const removable = unsent || failed || cancellable; // not a finished row, nor one that is just saving

  return (
    <li className="upload-row is-entering">
      <span className="upload-row__tile">
        <Icon size={20} aria-hidden="true" />
      </span>
      <div className="upload-row__info">
        <div className="upload-row__top">
          <span className="upload-row__name" title={name}>{name}</span>
          {sending && <span className="upload-row__percent">{Math.round(progress * 100)}%</span>}
        </div>
        <p
          className={`upload-row__meta${failed || status === "problem" ? " is-error" : ""}`}
          role={failed ? "alert" : undefined}
        >
          {metaText({ status, size, progress, error })}
        </p>
        {!unsent && (
          <ProgressBar
            steady
            className="upload-row__bar"
            tone={failed ? "danger" : status === "done" ? "good" : "accent"}
            value={status === "done" ? 1 : progress}
            label={`Uploading ${name}`}
          />
        )}
      </div>
      <div className="upload-row__side">
        {failed && retryable && (
          <Button variant="secondary" size="sm" onClick={onRetry} aria-label={`Retry ${name}`}>Retry</Button>
        )}
        {removable && <IconButton plain icon={X} label={`${cancellable ? "Cancel upload of" : "Remove"} ${name}`} onClick={onRemove} />}
        {status === "done" && (
          <span className="upload-row__done" role="img" aria-label="Uploaded">
            <Check size={16} aria-hidden="true" />
          </span>
        )}
      </div>
    </li>
  );
}
