import { useId, useState } from "react";
import { toast } from "react-toastify";
import { Image as ImageIcon, ImageOff, X } from "lucide-react";
import { Button, IconButton, ModalShell } from "@/shared/ui";
import { ensureLink } from "@/shared/lib/fileLinks";
import { formatSize } from "@/shared/lib/formatSize";
import { addedText } from "./fileKinds";
import useFileImage from "./useFileImage";

// Download opens the photo in a new tab: the storage serves a photo inline, so the browser shows it
// there and the photo is saved from that tab. The dialog may have been open longer than its link
// lives, so the link is fetched again on the click. The tab is opened before that wait, while the
// click still counts, or a popup blocker would stop it.
// With no tab (a blocked popup) the student is asked to allow it: sending the app itself to the photo
// would end any upload still running and leave the signed link in the address bar.
async function download(file) {
  const tab = window.open("", "_blank");
  if (!tab) {
    toast.error("Your browser blocked the new tab. Allow pop-ups for StressCare, then try again.");
    return;
  }
  tab.opener = null;
  const { url, error } = await ensureLink(file.id, "file");
  if (error) {
    tab.close();
    toast.error(error);
  } else {
    tab.location.replace(url);
  }
}

// A photo at full size (Figma 162:3776, 162:3972) on a dark scrim: name and size top left, Download,
// Delete and Close top right. On a phone Close sits beside the name and the two buttons are a row at
// the bottom. The picture comes from a fresh link and fades in.
export default function FilePreviewDialog({ file, now, onClose, onDelete }) {
  const titleId = useId();
  const [loaded, setLoaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
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
        <Button
          variant="secondary"
          disabled={downloading}
          onClick={async () => {
            setDownloading(true);
            await download(file);
            setDownloading(false);
          }}
        >
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
