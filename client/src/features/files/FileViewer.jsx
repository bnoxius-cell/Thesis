import { useId, useState } from "react";
import { X } from "lucide-react";
import { Button, IconButton, ModalShell } from "@/shared/ui";
import { formatSize } from "@/shared/lib/formatSize";
import { addedText, fileKind } from "./fileKinds";
import ViewerStage from "./ViewerStage";

// A stored file at full size (Figma F11, 162:3776 and 162:3972, for every kind) on a dark scrim: name
// and meta top left, Download, Delete and Close top right. On a phone Close sits beside the name and
// the two buttons are a row at the bottom. What fills the middle depends on the kind (ViewerStage).
// `onDownload` answers when the save has started (see downloadFile).
export default function FileViewer({ file, now, onClose, onDownload, onDelete }) {
  const titleId = useId();
  const metaId = useId();
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    await onDownload(file);
    setDownloading(false);
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={titleId}
      aria-describedby={metaId}
      className="files-preview"
      overlayClassName="files-preview-overlay"
    >
      <div className="files-preview__title">
        <h2 id={titleId}>{file.name}</h2>
        <p id={metaId}>
          {fileKind(file.ext).label} · {formatSize(file.size)} <span className="files-preview__added">· added {addedText(file.createdAt, now)}</span>
        </p>
      </div>
      <div className="files-preview__actions">
        <Button variant="secondary" disabled={downloading} onClick={download}>Download</Button>
        <Button variant="danger" onClick={() => onDelete(file)}>Delete</Button>
      </div>
      <IconButton plain label="Close" icon={X} onClick={onClose} className="files-preview__close" />
      <ViewerStage file={file} download={download} downloading={downloading} />
    </ModalShell>
  );
}
