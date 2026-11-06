import { Link, useParams } from "react-router-dom";
import { ChevronLeft, File, FileQuestion, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button, EmptyState, IconButton, Menu, MenuItem } from "@/shared/ui";
import { formatSize } from "@/shared/lib/formatSize";
import FilesDrop from "./FilesDrop";
import FilesNotice from "./FilesNotice";
import FilesTabsRow from "./FilesTabsRow";
import LibraryFileList from "./LibraryFileList";
import LibraryStatus from "./LibraryStatus";
import UploadButton from "./UploadButton";
import { GENERAL, filesIn } from "./places";

function FolderBody({ library, block, canUpload, phone, pickFiles, openFolderDialog }) {
  const { folderId } = useParams(); // absent on /study/files/general
  const folder = folderId ? library.locations.folders.find(({ id }) => id === folderId) : { name: "General" };

  if (!folder) {
    return (
      <EmptyState icon={FileQuestion} title="Folder not found" actions={<Button to="/study/files">Back to Files</Button>}>
        It may have been deleted, or it isn't in your account.
      </EmptyState>
    );
  }

  const files = filesIn(library.files, folderId ? `folder:${folderId}` : GENERAL);
  const total = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <>
      {block && <FilesNotice icon={block.icon}>{block.message}</FilesNotice>}
      <header className="files-folder-head">
        <Link to="/study/files" className="files-folder-head__back">
          <ChevronLeft size={20} aria-hidden="true" />
          Files
        </Link>
        <h2 className="files-folder-head__title">{folder.name}</h2>
        {folderId && (
          <Menu
            align="end"
            label={`Actions for ${folder.name}`}
            className="files-folder-head__more"
            trigger={(props) => <IconButton icon={MoreHorizontal} label={`More for ${folder.name}`} {...props} />}
          >
            <MenuItem icon={Pencil} onSelect={() => openFolderDialog("rename", folder)}>Rename</MenuItem>
            <MenuItem icon={Trash2} tone="danger" onSelect={() => openFolderDialog("delete", folder)}>Delete</MenuItem>
          </Menu>
        )}
        {!phone && <UploadButton disabled={!canUpload} onFiles={pickFiles} />}
        <p className="files-folder-head__meta">
          {files.length} {files.length === 1 ? "file" : "files"} · {formatSize(total)}
        </p>
      </header>
      <FilesDrop onFiles={pickFiles} disabled={!canUpload}>
        {files.length > 0 ? (
          <LibraryFileList library={library} files={files} />
        ) : (
          <div className="files-empty">
            <EmptyState
              icon={File}
              title={folderId ? "This folder is empty" : "General is empty"}
              actions={<UploadButton disabled={!canUpload} onFiles={pickFiles}>{`Upload to ${folder.name}`}</UploadButton>}
            >
              {folderId ? "Upload here, or use Move\u00a0to... on a file in another place." : `Files you upload here stay in ${folder.name}.`}
            </EmptyState>
          </div>
        )}
      </FilesDrop>
      {phone && files.length > 0 && <UploadButton floating disabled={!canUpload} onFiles={pickFiles} />}
    </>
  );
}

// General (/study/files/general) or one folder (/study/files/folders/:folderId), as Figma 151:2210
// (desktop), 155:1672 (phone) and 160:3288 (empty) draw it: back to Files, the name with a More menu
// (Rename, Delete: a folder only; General can't be renamed or deleted), Upload, and the files. On a
// desktop the folder header takes the tab track's place. An unknown or foreign id says so and offers
// the way back.
export default function FolderPage(props) {
  const { library } = props;
  return (
    <div className="files-page">
      <FilesTabsRow library={library} className="files-tabsrow--folder" />
      <div role="tabpanel" id="study-panel" aria-labelledby="study-tab-files" className="files-content">
        <LibraryStatus library={library} />
        {library.status === "ready" && <FolderBody {...props} />}
      </div>
    </div>
  );
}
