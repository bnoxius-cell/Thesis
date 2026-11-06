import { useId, useState } from "react";
import { Image as ImageIcon, ImageOff, X } from "lucide-react";
import { Button, IconButton, ModalShell } from "@/shared/ui";
import { addedText, formatSize } from "./fileKinds";
import useFileImage from "./useFileImage";

// A photo at full size (Figma 162:3776, 162:3972) on a dark scrim: name and size top left, Download,
// Delete and Close top right. On a phone Close sits beside the name and the two buttons are a row at
// the bottom. The picture comes from a fresh link and fades in. Download opens the same link in a
// new tab: the storage serves a photo inline, so the browser shows it there and the photo is saved
// from that tab.
export default function FilePreviewDialog({ file, now, onClose, onDelete }) {
  const titleId = useId();
  const [loaded, setLoaded] = useState(false);
  const { src, status, message, onError, retry } = useFileImage(file.id, "file");

  return (
    <ModalShell open onClose={onClose} labelledBy={titleId} className="files-preview" overlayClassName="files-preview-overlay">
      <div className="files-preview__title">
        <h2 id={titleId}>{file.name}</h2>
        <p>
          Photo · {formatSize(file.size)} <span className="files-preview__added">· added {addedText(file.createdAt, now)}</span>
        </p>
      </div>
      <div className="files-preview__actions">
        <Button variant="secondary" href={src ?? undefined} disabled={!src} target="_blank" rel="noopener noreferrer" download={file.name}>
          Download
        </Button>
        <Button variant="danger" onClick={() => onDelete(file)}>Delete</Button>
      </div>
      <IconButton plain label="Close" icon={X} onClick={onClose} className="files-preview__close" />
      <div className="files-preview__stage">
        {status === "failed" ? (
          <div className="files-preview__failed" role="alert">
            <ImageOff size={28} aria-hidden="true" />
            <p>{message || "Couldn't load this photo."}</p>
            <Button variant="secondary" size="sm" onClick={retry}>Try again</Button>
          </div>
        ) : (
          <>
            {!loaded && (
              <span className="files-preview__placeholder" aria-hidden="true">
                <ImageIcon size={32} />
              </span>
            )}
            {src && (
              <img
                src={src}
                alt={file.name}
                className={loaded ? "is-loaded" : undefined}
                onLoad={() => setLoaded(true)}
                onError={() => {
                  setLoaded(false);
                  onError();
                }}
              />
            )}
          </>
        )}
      </div>
    </ModalShell>
  );
}
