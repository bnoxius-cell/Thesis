import { useState } from "react";
import { ConfirmDialog } from "@/shared/ui";
import { deleteFolder } from "@/shared/api/files";
import { formatSize } from "@/shared/lib/formatSize";
import "./files-dialogs.css";

const CHOICES = [
  { value: "keep", title: "Keep the files", note: "They move to General." },
  { value: "delete", title: "Delete the files too", note: "They are removed for good. This can't be undone." },
];

const plural = (n) => `${n} ${n === 1 ? "file" : "files"}`;

// Delete folder (Figma 162:3111): with files in it, two radio cards ask what happens to them, "Keep
// the files" chosen. The button says what it will do ("Delete folder and 4 files"). An empty folder
// has nothing to ask. `files` are the folder's files; `onDeleted` runs once the server has deleted it.
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
      tone="danger"
      title={`Delete folder "${folder.name}"?`}
      confirmLabel={removing ? `Delete folder and ${plural(files.length)}` : "Delete folder"}
      busy={busy}
      onConfirm={confirm}
      onCancel={onClose}
    >
      {asks ? (
        <div className="files-choices">
          <p>This folder has {plural(files.length)} ({formatSize(total)}). What should happen to them?</p>
          <div role="radiogroup" aria-label="What happens to the files" className="files-choices__list">
            {CHOICES.map(({ value, title, note }) => (
              <label key={value} className="files-choice">
                <input type="radio" name="folder-files" checked={choice === value} onChange={() => setChoice(value)} />
                <span className="files-choice__text">
                  <strong>{title}</strong>
                  <span>{note}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        "It has no files in it."
      )}
      {error && <span className="files-dialog-error" role="alert"> {error}</span>}
    </ConfirmDialog>
  );
}
