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
import { uploadBlock } from "./fileNotice";
import { GENERAL, filesIn, placeOptions } from "./places";
import useLibrary from "./useLibrary";
import useUploadDialog from "./useUploadDialog";
import useUploads from "./useUploads";
import "./files.css";
import "./files-hub.css";

// The Files tab of Study and its folder views, /study/files and below (Figma 150:924, 151:2210):
// one page that holds the student's files, the upload queue and the dialogs, and shows the hub or a
// folder inside. Going from the hub into a folder keeps the files already loaded and any upload
// still running; leaving /study/files altogether cancels it, as on a subject's Files tab.
// Every way of adding files (the header "+", Upload, the empty states, a drop) opens the Upload
// dialog, which asks where they go, starts the queue and shows its progress.
export default function FilesPage() {
  const navigate = useNavigate();
  const library = useLibrary();
  const uploads = useUploads({ onUploaded: library.add, onSettled: library.refresh });
  const phone = useMediaQuery("(max-width: 1023px)"); // where the bottom bar is and Upload floats above it
  const openFolder = useMatch("/study/files/folders/:folderId")?.params.folderId;
  const upload = useUploadDialog(uploads, library.locations);
  const [folderDialog, setFolderDialog] = useState(null); // { type: "new" | "rename" | "delete", folder? }

  const ready = library.status === "ready";
  const block = ready ? uploadBlock(library, library.files.length) : null;
  const canUpload = ready && !block;

  // The dialog starts on where the student is, if that is a place a file can go. `files` are the ones
  // dropped on the page; the buttons open it empty.
  const openUpload = (files = []) => {
    const here = openFolder ? `folder:${openFolder}` : GENERAL;
    const known = placeOptions(library.locations).some(({ value }) => value === here);
    upload.open(known ? here : GENERAL, files);
  };
  const openFolderDialog = (type, folder) => setFolderDialog({ type, folder });
  const closeFolderDialog = () => setFolderDialog(null);

  const shared = { library, block, canUpload, phone, uploadStatus: upload.status, openUpload, openFolderDialog };

  return (
    <Page
      title="Study"
      action={ready && <UploadButton round status={upload.status} disabled={!canUpload} onClick={() => openUpload()}>Upload</UploadButton>}
    >
      <Routes>
        <Route index element={<FilesHub {...shared} />} />
        <Route path="general" element={<FolderPage {...shared} />} />
        <Route path="folders/:folderId" element={<FolderPage {...shared} />} />
        <Route path="*" element={<Navigate to="/study/files" replace />} />
      </Routes>
      {upload.isOpen && (
        <UploadDialog
          uploads={uploads}
          place={upload.place}
          initialFiles={upload.initialFiles}
          locations={library.locations}
          usage={library.usage}
          block={block}
          onClose={upload.close}
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
    </Page>
  );
}
