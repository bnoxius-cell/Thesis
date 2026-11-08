import { useEffect, useRef, useState } from "react";
import { Download, FileWarning } from "lucide-react";
import { BusySpinner, Button } from "@/shared/ui";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import { previewText, viewKindOf } from "@/utils/fileView";
import { fileKind } from "./fileKinds";
import PhotoStage from "./PhotoStage";
import useFileBlob from "./useFileBlob";

// What the viewer shows under its bar (plan 23, 4.2 and 4.3). A photo is an <img> on a fresh link.
// A PDF is the browser's own viewer in a frame, only on a desktop that has one; a text file is plain
// React text. Both come from the file's bytes in memory, never from a signed link in the page. Word,
// PowerPoint and Excel files, and PDFs on a phone, get a card with Download and nothing is fetched.
const INLINE_PDF = "(hover: hover) and (pointer: fine)";
const OPENS_IN = { Word: "Word or Google Docs", PowerPoint: "PowerPoint or Google Slides", Excel: "Excel or Google Sheets" };

function ViewerCard({ Icon, title, children, action, alert = false }) {
  return (
    <div className="files-preview__card" role={alert ? "alert" : undefined}>
      <Icon size={28} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

function DownloadButton({ download, downloading }) {
  return (
    <Button icon={Download} busy={downloading} onClick={download}>Download</Button>
  );
}

function Loading({ name }) {
  return (
    <p className="files-preview__placeholder files-preview__placeholder--loading" role="status">
      <BusySpinner />
      Opening {name}...
    </p>
  );
}

// The frame points at a Blob URL made for it and revoked when it goes. The Blob is typed as a PDF by
// the loader, and only after its bytes were checked. No sandbox: Chrome won't draw a PDF in one. A
// frame hides its keys from the dialog, so a sentinel after it catches Tab leaving the PDF (back to
// the first button) and Shift+Tab wrapping round from the first button (on into the frame).
function PdfSheet({ blob, name }) {
  const frame = useRef(null);
  const [url, setUrl] = useState(null);

  useEffect(() => {
    const made = URL.createObjectURL(blob);
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [blob]);

  const wrap = (e) => {
    const fromBar = e.relatedTarget && e.relatedTarget !== frame.current;
    const dialog = e.currentTarget.closest(".files-preview");
    (fromBar ? frame.current : dialog.querySelector("button:not(:disabled)"))?.focus();
  };

  if (!url) return null;
  return (
    <>
      <iframe ref={frame} src={url} title={`${name}, PDF`} tabIndex={0} className="files-preview__sheet files-preview__sheet--pdf" />
      <span tabIndex={0} onFocus={wrap} />
    </>
  );
}

// The text, as React text in a <pre>: never HTML, never a frame. A long file shows its first part.
function TextSheet({ blob, name }) {
  const [read, setRead] = useState(null); // { text, cut }, or { failed: true }

  useEffect(() => {
    let live = true;
    blob.text().then(
      (text) => live && setRead(previewText(text)),
      () => live && setRead({ failed: true }),
    );
    return () => {
      live = false;
    };
  }, [blob]);

  if (!read) return <Loading name={name} />;
  if (read.failed) return <ViewerCard Icon={FileWarning} title="Couldn't show this file here." alert>Download it instead.</ViewerCard>;
  return (
    <div className="files-preview__sheet files-preview__sheet--text" tabIndex={0} role="region" aria-label={name}>
      {read.cut && <p className="files-preview__cut">Showing the first part of this file. Download it to see all of it.</p>}
      {read.text ? <pre>{read.text}</pre> : <p>This file is empty.</p>}
    </div>
  );
}

function BlobStage({ file, kind, download, downloading }) {
  const { blob, loading, error, fallback, retry } = useFileBlob(file);
  if (loading) return <Loading name={file.name} />;
  if (fallback) {
    return (
      <ViewerCard Icon={FileWarning} title="Couldn't show this file here." action={<DownloadButton download={download} downloading={downloading} />} alert>
        Download it instead.
      </ViewerCard>
    );
  }
  if (error) {
    return (
      <ViewerCard Icon={FileWarning} title="Couldn't open this file" action={<Button variant="secondary" onClick={retry}>Try again</Button>} alert>
        {error}
      </ViewerCard>
    );
  }
  return kind === "pdf" ? <PdfSheet blob={blob} name={file.name} /> : <TextSheet blob={blob} name={file.name} />;
}

// `download` saves the file and `downloading` is true while it does (see FileViewer).
export default function ViewerStage({ file, download, downloading }) {
  const kind = viewKindOf(file.ext);
  const desktop = useMediaQuery(INLINE_PDF);
  const inline = kind === "text" || (kind === "pdf" && desktop && navigator.pdfViewerEnabled === true);

  if (kind === "photo") {
    return (
      <div className="files-preview__stage files-preview__stage--photo">
        <PhotoStage file={file} />
      </div>
    );
  }

  const { Icon, label } = fileKind(file.ext);
  const action = <DownloadButton download={download} downloading={downloading} />;
  return (
    <div className="files-preview__stage files-preview__stage--sheet">
      {inline && <BlobStage file={file} kind={kind} download={download} downloading={downloading} />}
      {!inline && kind === "pdf" && (
        <ViewerCard Icon={Icon} title="Open this PDF" action={action}>PDFs open in your phone's PDF app.</ViewerCard>
      )}
      {!inline && kind === "none" && (
        <ViewerCard Icon={Icon} title="Preview not available" action={action}>
          {OPENS_IN[label]
            ? `${label} files can't be shown here yet. Download it to open it in ${OPENS_IN[label]}.`
            : "This kind of file can't be shown here yet. Download it to open it on your device."}
        </ViewerCard>
      )}
    </div>
  );
}
