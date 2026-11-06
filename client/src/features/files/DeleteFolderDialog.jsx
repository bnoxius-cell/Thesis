import { useState } from "react";
import { ConfirmDialog } from "@/shared/ui";
import { deleteFolder } from "@/shared/api/files";
import { formatSize } from "@/shared/lib/formatSize";
import FilesChoice from "./FilesChoice";
import { filesText } from "./fileKinds";

// Delete folder (Figma 162:3111, phone sheet 162:3311): with files in it, two radio cards ask what
// happens to them, "Keep the files" chosen. The button says what it will do ("Delete folder and 4
// files"). An empty folder has nothing to ask. `files` are the folder's files; `onDeleted` runs once
// the server has deleted it.
export default function DeleteFolderDialog({ folder, files, onClose, onDeleted }) {
  const [choice, setChoice] = useState("keep");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = files.reduce((sum, file) => sum + file.size, 0);
  const asks = files.length > 0;
  const removing = asks && choice === "delete";

  const confirm = async () => {
    setBusy(true);
    setError("");
    const { error: failure } = await deleteFolder(folder.id, asks ? choice : "keep");
    setBusy(false);
    if (failure) setError(failure);
    else onDeleted(folder);
  };

  return (
    <ConfirmDialog
      open
      sheet
      tone="danger"
      title={`Delete folder "${folder.name}"?`}
      confirmLabel={removing ? `Delete folder and ${filesText(files.length)}` : "Delete folder"}
      busy={busy}
      onConfirm={confirm}
      onCancel={onClose}
    >
      {asks ? (
        <FilesChoice
          intro={`This folder has ${filesText(files.length)} (${formatSize(total)}). What should happen to the files?`}
          value={choice}
          onChange={setChoice}
        />
      ) : (
        "It has no files in it."
      )}
      {error && <span className="files-dialog-error" role="alert"> {error}</span>}
    </ConfirmDialog>
  );
}
