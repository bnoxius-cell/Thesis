import { useState } from "react";
import { Button, Field, Modal } from "@/shared/ui";
import { createFolder, renameFolder } from "@/shared/api/files";

const NAME_MAX = 40; // the server's limit, which it checks again

const clean = (value) => value.replace(/\s+/g, " ").trim();

// New folder, or Rename folder when `folder` is given (Figma 162:2669, phone sheet 162:2926). The server checks
// the name, so a taken name or "General" comes back as its own plain sentence under the field and the
// dialog stays open. `onSaved` gets the folder as the server stored it.
export default function FolderDialog({ folder, onClose, onSaved }) {
  const renaming = Boolean(folder);
  const [name, setName] = useState(folder?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    const value = clean(name);
    if (!value) return setError("Give the folder a name.");
    if (renaming && value === folder.name) return onClose();
    setBusy(true);
    setError("");
    const { data, error: failure } = await (renaming ? renameFolder(folder.id, value) : createFolder(value));
    setBusy(false);
    if (failure) setError(failure);
    else onSaved(data.folder);
  };

  return (
    <Modal
      sheet
      as="form"
      onSubmit={submit}
      noValidate
      className="files-dialog"
      title={renaming ? "Rename folder" : "New folder"}
      subtitle="Folders keep files together across subjects."
      busy={busy}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" busy={busy}>{busy ? "Saving" : renaming ? "Save" : "Create folder"}</Button>
        </>
      }
    >
      <Field
        label="Folder name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setError("");
        }}
        error={error}
        hint={`Up to ${NAME_MAX} characters.`}
        maxLength={NAME_MAX}
        autoComplete="off"
        autoFocus
      />
    </Modal>
  );
}
