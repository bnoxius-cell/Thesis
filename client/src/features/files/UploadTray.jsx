import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { Button, IconButton, ProgressBar } from "@/shared/ui";
import "./files.css";

const count = (items, ...statuses) => items.filter((item) => statuses.includes(item.status)).length;

function title(items) {
  const busy = count(items, "queued", "uploading");
  const plural = items.length === 1 ? "" : "s";
  if (busy) return `Uploading ${items.length} file${plural}`;
  return count(items, "failed") ? "Some files didn't upload" : `Uploaded ${items.length} file${plural}`;
}

function UploadRow({ item, onRetry, onDismiss }) {
  const { status } = item;
  // Every byte has been sent and the server is storing the file: it will land, so it can't be cancelled.
  const saving = status === "uploading" && item.progress >= 1;
  return (
    <li className="files-up">
      <div className="files-up__line">
        <span className="files-up__name">{item.name}</span>
        {status === "uploading" && <span className="files-up__state">{saving ? "Saving" : `${Math.round(item.progress * 100)}%`}</span>}
        {status === "queued" && <span className="files-up__state">Waiting</span>}
        {status === "done" && (
          <span className="files-up__state files-up__state--done">
            <Check size={16} aria-hidden="true" /> Uploaded
          </span>
        )}
        {((status === "uploading" && !saving) || status === "queued") && (
          <IconButton plain icon={X} label={`Cancel upload of ${item.name}`} onClick={() => onDismiss(item.key)} />
        )}
      </div>
      {status === "uploading" && (
        <ProgressBar steady value={item.progress} label={`Uploading ${item.name}`} />
      )}
      {status === "failed" && (
        <>
          <p className="files-up__error" role="alert">{item.error}</p>
          <div className="files-up__actions">
            {item.retryable && <Button size="sm" variant="secondary" onClick={() => onRetry(item.key)}>Retry</Button>}
            <Button size="sm" variant="ghost" onClick={() => onDismiss(item.key)}>Remove</Button>
          </div>
        </>
      )}
    </li>
  );
}

// The upload tray (Figma 158:2242, 158:2396): bottom right on a desktop, above the bottom bar on a
// phone. One row per file: a bar and Cancel while it goes, a check when it landed, the server's
// message with Retry and Remove when it didn't. It is in the page body so no scrolling or animated
// ancestor moves it.
export default function UploadTray({ items, onRetry, onDismiss }) {
  if (items.length === 0) return null;
  return createPortal(
    <section className="files-tray" aria-label="Uploads">
      <h2 className="files-tray__title">{title(items)}</h2>
      <ul className="files-tray__list">
        {items.map((item) => (
          <UploadRow key={item.key} item={item} onRetry={onRetry} onDismiss={onDismiss} />
        ))}
      </ul>
      <p className="sr-only" role="status">
        {count(items, "done")} of {items.length} uploaded
      </p>
    </section>,
    document.body,
  );
}
