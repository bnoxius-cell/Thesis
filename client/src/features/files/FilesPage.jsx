import { useState } from "react";
import { Navigate, Route, Routes, useMatch, useNavigate } from "react-router-dom";
import Page from "@/app/shell/Page";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import DeleteFolderDialog from "./DeleteFolderDialog";
import FilesHub from "./FilesHub";
import FolderDialog from "./FolderDialog";
import FolderPage from "./FolderPage";
import UploadButton from "./UploadButton";
import UploadDialog from "./UploadDialog";
import UploadTray from "./UploadTray";
import { uploadBlock } from "./fileNotice";
import { MAX_PICK } from "./fileRules";
import { GENERAL, filesIn, placeOptions } from "./places";
import useLibrary from "./useLibrary";
import useUploads from "./useUploads";
import "./files.css";
import "./files-hub.css";

// The Files tab of Study and its folder views, /study/files and below (Figma 150:924, 151:2210):
// one page that holds the student's files, the upload queue and the dialogs, and shows the hub or a
// folder inside. Going from the hub into a folder keeps the files already loaded and any upload
// still running; leaving /study/files altogether cancels it, as on a subject's Files tab.
// Every way of picking files (the header "+", Upload, the empty states, a drop) opens the Upload
// files dialog, which asks where they go and starts the queue.
export default function FilesPage() {
  const navigate = useNavigate();
  const library = useLibrary();
  const uploads = useUploads({ onUploaded: library.add, onSettled: library.refresh });
  const phone = useMediaQuery("(max-width: 1023px)"); // where the bottom bar is and Upload floats above it
  const openFolder = useMatch("/study/files/folders/:folderId")?.params.folderId;
  const [picked, setPicked] = useState(null); // { files, left, place }: waiting in the Upload dialog
  const [folderDialog, setFolderDialog] = useState(null); // { type: "new" | "rename" | "delete", folder? }

  const ready = library.status === "ready";
  const block = ready ? uploadBlock(library, library.files.length) : null;
  const canUpload = ready && !block;

  // The dialog starts on where the student is, if that is a place a file can go. It takes the first
  // MAX_PICK files and says how many were left out.
  const pickFiles = (files) => {
    if (files.length === 0) return;
    const here = openFolder ? `folder:${openFolder}` : GENERAL;
    const known = placeOptions(library.locations).some(({ value }) => value === here);
    setPicked({ files: files.slice(0, MAX_PICK), left: Math.max(0, files.length - MAX_PICK), place: known ? here : GENERAL });
  };
  const openFolderDialog = (type, folder) => setFolderDialog({ type, folder });
  const closeFolderDialog = () => setFolderDialog(null);

  const shared = { library, block, canUpload, phone, pickFiles, openFolderDialog };

  return (
    <Page
      title="Study"
      action={ready && <UploadButton round disabled={!canUpload} onFiles={pickFiles}>Upload</UploadButton>}
    >
      <Routes>
        <Route index element={<FilesHub {...shared} />} />
        <Route path="general" element={<FolderPage {...shared} />} />
        <Route path="folders/:folderId" element={<FolderPage {...shared} />} />
        <Route path="*" element={<Navigate to="/study/files" replace />} />
      </Routes>
      {picked && (
        <UploadDialog
          files={picked.files}
          left={picked.left}
          place={picked.place}
          locations={library.locations}
          onClose={() => setPicked(null)}
          onConfirm={(files, place) => {
            uploads.add(files, place);
            setPicked(null);
          }}
        />
      )}
      {(folderDialog?.type === "new" || folderDialog?.type === "rename") && (
        <FolderDialog
          folder={folderDialog.folder}
          onClose={closeFolderDialog}
          onSaved={() => {
            closeFolderDialog();
            library.refresh();
          }}
        />
      )}
      {folderDialog?.type === "delete" && (
        <DeleteFolderDialog
          folder={folderDialog.folder}
          files={filesIn(library.files, `folder:${folderDialog.folder.id}`)}
          onClose={closeFolderDialog}
          onDeleted={() => {
            uploads.rehome(`folder:${folderDialog.folder.id}`);
            closeFolderDialog();
            navigate("/study/files", { replace: true });
            library.refresh();
          }}
        />
      )}
      <UploadTray items={uploads.items} onRetry={uploads.retry} onDismiss={uploads.dismiss} />
    </Page>
  );
}
