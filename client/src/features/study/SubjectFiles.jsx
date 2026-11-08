import { FileText } from "lucide-react";
import { EmptyState } from "@/shared/ui";
import FilesDrop from "@/features/files/FilesDrop";
import FilesNotice from "@/features/files/FilesNotice";
import LibraryFileList from "@/features/files/LibraryFileList";
import LibraryStatus from "@/features/files/LibraryStatus";
import StorageMeter from "@/features/files/StorageMeter";
import UploadButton from "@/features/files/UploadButton";
import { formatSize } from "@/shared/lib/formatSize";
import { NEAR_FULL } from "@/features/files/fileNotice";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import "@/features/files/files.css";

// The Files tab of a subject (Figma 157:1477, 157:1789): "3 files · 6.8 MB" and Upload, then the
// files; an empty tab says so and offers the same upload. Upload and a drop open the Upload dialog,
// which starts on this subject. Uploading is off, with the reason above the list, when the subject is
// archived, uploads are paused or the student's space is full. The storage meter appears only once
// space runs low. `library`, `block`, `uploadStatus` and `openUpload` come from useSubjectFiles; the page shows the dialog.
export default function SubjectFiles({ subject, library, block, uploadStatus, openUpload }) {
  const archived = Boolean(subject.archivedAt);
  const phone = useMediaQuery("(max-width: 1023px)"); // where the bottom bar is and Upload floats above it

  if (library.status !== "ready") return <LibraryStatus library={library} />;

  const canUpload = !block;

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
          {!archived && <UploadButton floating={phone} status={uploadStatus} disabled={!canUpload} onClick={() => openUpload()} />}
        </div>
      )}
      <FilesDrop onFiles={openUpload} disabled={!canUpload}>
        {files.length > 0 ? (
          <LibraryFileList library={library} files={files} />
        ) : (
          <div className="files-empty">
            <EmptyState
              icon={FileText}
              title="No files yet"
              actions={
                !archived && (
                  <UploadButton disabled={!canUpload} onClick={() => openUpload()}>
                    Upload a file
                  </UploadButton>
                )
              }
            >
              {archived ? "Nothing was uploaded to this subject." : "Upload notes, handouts or photos for this subject."}
            </EmptyState>
          </div>
        )}
      </FilesDrop>
    </div>
  );
}
