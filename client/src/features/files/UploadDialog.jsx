import { useState } from "react";
import { X } from "lucide-react";
import { Button, Field, IconButton, Modal, SelectButton } from "@/shared/ui";
import { formatSize } from "@/shared/lib/formatSize";
import { fileKind } from "./fileKinds";
import { MAX_PICK, extensionOf } from "./fileRules";
import { placeOptions } from "./places";
import "./files-dialogs.css";

// The Upload files dialog (Figma 158:1906, 158:2079): the files picked or dropped, each with a way
// to take it out, and where to save them. `place` is where the student is (General on the hub, the
// open folder on its page). `left` is how many picked files were over the MAX_PICK limit and aren't
// in `files`; the subtitle says so. Nothing is sent until the button; `onConfirm` gets the files
// still listed and the chosen place. Taking out the last file closes it.
export default function UploadDialog({ files, left = 0, place, locations, onConfirm, onClose }) {
  const [picked, setPicked] = useState(files);
  const [to, setTo] = useState(place);
  const options = placeOptions(locations);
  const count = picked.length;
  const leftOut = left > 0 ? ` Only the first ${MAX_PICK} were added: you can upload ${MAX_PICK} at a time.` : "";

  const remove = (file) => {
    const rest = picked.filter((item) => item !== file);
    if (rest.length === 0) onClose();
    else setPicked(rest);
  };

  return (
    <Modal
      sheet
      className="files-dialog"
      title="Upload files"
      subtitle={`${count} ${count === 1 ? "file" : "files"} ready. Pick where ${count === 1 ? "it" : "they"} should go.${leftOut}`}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(picked, to)}>{`Upload ${count} ${count === 1 ? "file" : "files"}`}</Button>
        </>
      }
    >
      <ul className="files-dialog__files">
        {picked.map((file, index) => {
          const { Icon } = fileKind(extensionOf(file.name));
          return (
            <li key={`${file.name}-${index}`} className="files-dialog__file">
              <Icon size={20} aria-hidden="true" />
              <span className="files-dialog__text">
                <strong>{file.name}</strong>
                <span>{formatSize(file.size)}</span>
              </span>
              <IconButton plain icon={X} label={`Remove ${file.name}`} onClick={() => remove(file)} />
            </li>
          );
        })}
      </ul>
      <Field label="Save to" hint="You can move files later.">
        {(wiring) => <SelectButton block options={options} value={to} onChange={setTo} {...wiring} />}
      </Field>
    </Modal>
  );
}
