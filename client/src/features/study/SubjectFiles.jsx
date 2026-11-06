import { FileText, Info } from "lucide-react";
import { EmptyState } from "@/shared/ui";
import FilesDrop from "@/features/files/FilesDrop";
import FilesNotice from "@/features/files/FilesNotice";
import LibraryFileList from "@/features/files/LibraryFileList";
import LibraryStatus from "@/features/files/LibraryStatus";
import StorageMeter from "@/features/files/StorageMeter";
import UploadButton from "@/features/files/UploadButton";
import { formatSize } from "@/shared/lib/formatSize";
import { NEAR_FULL, uploadBlock } from "@/features/files/fileNotice";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import "@/features/files/files.css";

const ARCHIVED = { icon: Info, message: "This subject is archived. You can open its files but not add new ones." };

// The Files tab of a subject (Figma 157:1477, 157:1789): "3 files · 6.8 MB" and Upload, then the
// files; an empty tab says so and offers the same upload. Files you upload or drop here go to this
// subject. Uploading is off, with the reason above the list, when the subject is archived, uploads
// are paused or the student's space is full. The storage meter appears only once space runs low.
// `library` and `uploads` come from useSubjectFiles; the page shows the upload tray.
export default function SubjectFiles({ subject, library, uploads }) {
  const archived = Boolean(subject.archivedAt);
  const phone = useMediaQuery("(max-width: 1023px)"); // where the bottom bar is and Upload floats above it

  if (library.status !== "ready") return <LibraryStatus library={library} />;

  const block = archived ? ARCHIVED : uploadBlock(library);
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
          {!archived && <UploadButton floating={phone} disabled={!canUpload} onFiles={uploads.add} />}
        </div>
      )}
      <FilesDrop onFiles={uploads.add} disabled={!canUpload}>
        {files.length > 0 ? (
          <LibraryFileList library={library} files={files} />
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
      </FilesDrop>
    </div>
  );
}
