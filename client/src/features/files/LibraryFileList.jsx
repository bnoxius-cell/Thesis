import { useState } from "react";
import DeleteFileDialog from "./DeleteFileDialog";
import FileList from "./FileList";
import FilePreviewDialog from "./FilePreviewDialog";
import useOpenFile from "./useOpenFile";
import useNow from "@/shared/hooks/useNow";

// A list of the student's files with what a row can do: open one (a photo in the preview dialog, a
// document as a download) and delete one after asking. `library` is useLibrary's answer; a deleted row
// collapses, then leaves the list and the usage is fetched again. `placeName` adds the place chip.
export default function LibraryFileList({ library, files, placeName }) {
  const now = useNow();
  const { previewing, open, closePreview } = useOpenFile();
  const [deleting, setDeleting] = useState(null);

  return (
    <>
      <FileList
        files={files}
        freshIds={library.freshIds}
        leavingIds={library.leavingIds}
        now={now}
        placeName={placeName}
        onOpen={open}
        onDelete={setDeleting}
        onGone={(id) => {
          library.remove(id);
          library.refresh();
        }}
      />
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
    </>
  );
}
