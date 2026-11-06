import { useState } from "react";
import { ConfirmDialog } from "@/shared/ui";
import { deleteFile } from "@/shared/api/files";

// Confirms deleting a file. A failed delete keeps the dialog open with the server's message.
export default function DeleteFileDialog({ file, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setBusy(true);
    setError("");
    const { error: failure } = await deleteFile(file.id);
    setBusy(false);
    if (failure) setError(failure);
    else onDeleted(file);
  };

  return (
    <ConfirmDialog
      open
      tone="danger"
      title={`Delete ${file.name}?`}
      confirmLabel="Delete file"
      busy={busy}
      onConfirm={confirm}
      onCancel={onClose}
    >
      It's gone for good and the space comes back to you.
      {error && <span className="files-dialog-error" role="alert"> {error}</span>}
    </ConfirmDialog>
  );
}
