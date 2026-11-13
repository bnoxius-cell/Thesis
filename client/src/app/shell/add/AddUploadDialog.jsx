import { useEffect, useRef } from "react";
import { toast } from "react-toastify";
import UploadDialog from "@/features/files/UploadDialog";
import { uploadBlock } from "@/features/files/fileNotice";
import { GENERAL } from "@/features/files/places";
import useLibrary from "@/features/files/useLibrary";
import useUploadDialog from "@/features/files/useUploadDialog";
import useUploads, { isBusy } from "@/features/files/useUploads";

// The File row of the global add on a page that holds no upload queue of its own (Files and a Subject page
// register theirs, see useAddHere). It has its own queue and opens the Upload dialog on General. Closing the
// dialog while files are still going keeps this mounted, out of sight, so they finish and the usual
// "Uploaded ..." toast fires; it calls `onClose` once nothing is running.
export default function AddUploadDialog({ onClose }) {
  const library = useLibrary();
  const uploads = useUploads({ onUploaded: library.add, onSettled: library.refresh });
  const upload = useUploadDialog(uploads, library.locations);
  const ready = library.status === "ready";
  const opened = useRef(false);
  const { open } = upload;

  useEffect(() => {
    if (ready && !opened.current) {
      opened.current = true;
      open(GENERAL);
    }
  }, [ready, open]);

  const failed = library.status === "failed";
  useEffect(() => {
    if (failed) toast.error(library.error);
  }, [failed, library.error]);

  const finished = failed || (opened.current && !upload.isOpen && !uploads.items.some(isBusy));
  useEffect(() => {
    if (finished) onClose();
  }, [finished, onClose]);

  if (!upload.isOpen || !ready) return null;
  return (
    <UploadDialog
      uploads={uploads}
      place={upload.place}
      initialFiles={upload.initialFiles}
      locations={library.locations}
      usage={library.usage}
      block={uploadBlock(library, library.files.length)}
      onFolderCreated={library.refresh}
      onClose={upload.close}
    />
  );
}
