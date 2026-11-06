import { useState } from "react";
import { FileText, Info } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/shared/ui";
import DeleteFileDialog from "@/features/files/DeleteFileDialog";
import FileList from "@/features/files/FileList";
import FilePreviewDialog from "@/features/files/FilePreviewDialog";
import FilesNotice from "@/features/files/FilesNotice";
import StorageMeter from "@/features/files/StorageMeter";
import UploadButton from "@/features/files/UploadButton";
import { formatSize } from "@/shared/lib/formatSize";
import { NEAR_FULL, uploadBlock } from "@/features/files/fileNotice";
import useOpenFile from "@/features/files/useOpenFile";
import useFileDrop from "@/shared/hooks/useFileDrop";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import useNow from "@/shared/hooks/useNow";
import "@/features/files/files.css";

const ARCHIVED = { icon: Info, message: "This subject is archived. You can open its files but not add new ones." };

// The Files tab of a subject (Figma 157:1477, 157:1789): "3 files · 6.8 MB" and Upload, then the
// files; an empty tab says so and offers the same upload. Files you upload or drop here go to this
// subject. Uploading is off, with the reason above the list, when the subject is archived, uploads
// are paused or the student's space is full. The storage meter appears only once space runs low.
// `library` and `uploads` come from useSubjectFiles; the page shows the upload tray.
export default function SubjectFiles({ subject, library, uploads }) {
  const now = useNow();
  const archived = Boolean(subject.archivedAt);
  const phone = useMediaQuery("(max-width: 1023px)"); // where the bottom bar is and Upload floats above it
  const { previewing, open, closePreview } = useOpenFile();
  const [deleting, setDeleting] = useState(null);

  const ready = library.status === "ready";
  const block = archived ? ARCHIVED : ready && uploadBlock(library);
  const canUpload = ready && !block;
  const { over, dropProps } = useFileDrop({ onFiles: uploads.add, disabled: !canUpload });

  if (library.status === "loading") {
    return (
      <div className="files-tab" role="status" aria-label="Loading your files">
        <Skeleton className="files-skeleton" height="72px" />
        <Skeleton className="files-skeleton" height="72px" />
      </div>
    );
  }
  if (library.status === "failed") {
    return (
      <EmptyState
        icon={FileText}
        title="Couldn't load your files"
        actions={<Button variant="secondary" onClick={library.reload}>Try again</Button>}
      >
        {library.error}
      </EmptyState>
    );
  }

  const files = archived ? library.files.filter((file) => file.location.id === subject._id) : library.files;
  const total = files.reduce((sum, file) => sum + file.size, 0);
  const nearFull = library.usage && library.usage.usedBytes / library.usage.limitBytes >= NEAR_FULL;

  return (
    <div className="files-tab">
      {block && <FilesNotice icon={block.icon}>{block.message}</FilesNotice>}
      {nearFull && <StorageMeter usage={library.usage} />}
      {files.length > 0 && (
        <div className="files-head">
          <p className="files-head__count">
            {files.length} {files.length === 1 ? "file" : "files"} · {formatSize(total)}
          </p>
          {!archived && <UploadButton floating={phone} disabled={!canUpload} onFiles={uploads.add} />}
        </div>
      )}
      <div {...dropProps} className={`files-drop${over ? " is-over" : ""}`}>
        {files.length > 0 ? (
          <FileList
            files={files}
            freshIds={library.freshIds}
            leavingIds={library.leavingIds}
            now={now}
            onOpen={open}
            onDelete={setDeleting}
            onGone={(id) => {
              library.remove(id);
              library.refresh();
            }}
          />
        ) : (
          <div className="files-empty">
            <EmptyState
              icon={FileText}
              title="No files yet"
              actions={
                !archived && (
                  <UploadButton disabled={!canUpload} onFiles={uploads.add}>
                    Upload a file
                  </UploadButton>
                )
              }
            >
              {archived ? "Nothing was uploaded to this subject." : "Upload notes, handouts or photos for this subject."}
            </EmptyState>
          </div>
        )}
      </div>
      {previewing && (
        <FilePreviewDialog
          file={previewing}
          now={now}
          onClose={closePreview}
          onDelete={(file) => {
            closePreview();
            setDeleting(file);
          }}
        />
      )}
      {deleting && (
        <DeleteFileDialog
          file={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(file) => {
            setDeleting(null);
            library.retire(file.id);
          }}
        />
      )}
    </div>
  );
}
