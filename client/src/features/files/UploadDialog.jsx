import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { Button, Field, Modal, SelectButton } from "@/shared/ui";
import useFileDrop from "@/shared/hooks/useFileDrop";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import { formatSize } from "@/shared/lib/formatSize";
import FilesNotice from "./FilesNotice";
import FolderDialog from "./FolderDialog";
import PlaceMark from "./PlaceMark";
import UploadRow from "./UploadRow";
import { filesText } from "./fileKinds";
import { usageText } from "./fileNotice";
import { FILE_ACCEPT, MAX_FILE_BYTES, MAX_PICK, extensionOf, fileProblem } from "./fileRules";
import { placeOptions, placesText } from "./places";
import { isBusy } from "./useUploads";
import "./upload-dialog.css";

const NEW_FOLDER = "new-folder"; // the last "Save to" row: opens the folder dialog, is never a chosen value
const NOTHING_PICKED = { rows: [], leftOut: false };
let nextPickId = 0;

// Adds files to the picked list, up to MAX_PICK rows in all; `leftOut` remembers that some didn't fit.
function pickMore(current, incoming) {
  const room = MAX_PICK - current.rows.length;
  const added = incoming.slice(0, room).map((file) => ({ id: nextPickId++, file, problem: fileProblem(file) }));
  return { rows: [...current.rows, ...added], leftOut: current.leftOut || incoming.length > room };
}

function queueTitle(items) {
  if (items.some(isBusy)) return `Uploading ${filesText(items.length)}`;
  return items.some((item) => item.status === "failed") ? "Some files didn't upload" : `Uploaded ${filesText(items.length)}`;
}

// "Saving to DBMS 101", "Saved to General" once every file is in, "Saving to 2 places" if they differ.
function queueSubtitle(items, options) {
  const verb = items.every((item) => item.status === "done") ? "Saved to" : "Saving to";
  return `${verb} ${placesText(items, options)}`;
}

// While the dialog is open, a file dropped outside its card (on the dimmed page) must not open in the tab.
function useKeepFilesOut() {
  useEffect(() => {
    const stop = (event) => {
      if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
    };
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("drop", stop);
    };
  }, []);
}

// The Upload dialog (Figma 189:3749 choose, 189:4052 uploading): two views of one dialog.
//   choose  the drop zone (or, once files are picked, their rows and an Add more bar), where to save
//           them, and Upload. Nothing is sent until Upload; closing discards what was picked.
//   queue   the page's uploads (`uploads.items`) with their progress, whenever there are any. Closing
//           the dialog doesn't stop them.
// `place` is where the student is, the default for "Save to"; `initialFiles` were dropped on the page.
// `block` is why uploading is off right now ({ icon, message }) or null. On a phone it is a bottom sheet.
// "New folder" in the Save to list opens the folder dialog over this one; `onFolderCreated` is the page's
// chance to fetch the library again, and the new folder becomes the place the files go to.
export default function UploadDialog({ uploads, place, initialFiles, locations, usage, block, onFolderCreated, onClose }) {
  const { items } = uploads;
  const queue = items.length > 0;
  const phone = useMediaQuery("(max-width: 719.98px)");
  const [picked, setPicked] = useState(() => pickMore(NOTHING_PICKED, initialFiles));
  const [to, setTo] = useState(place);
  const [naming, setNaming] = useState(false); // the New folder dialog is open
  const inputRef = useRef(null);
  const focusRef = useRef(null); // the view's main control: Modal focuses it on opening
  const options = useMemo(
    () => placeOptions(locations).map((option) => ({ ...option, leading: <PlaceMark place={option.value} color={option.color} /> })),
    [locations],
  );
  const saveToOptions = useMemo(
    () => [...options, { value: NEW_FOLDER, label: "New folder...", leading: <Plus size={20} aria-hidden="true" /> }],
    [options],
  );
  const choosePlace = (value) => (value === NEW_FOLDER ? setNaming(true) : setTo(value));
  // The folder list comes back from the server before the new folder is picked, so the select never shows a place it doesn't know.
  const folderCreated = async (folder) => {
    setNaming(false);
    await onFolderCreated();
    setTo(`folder:${folder.id}`);
  };
  const valid = picked.rows.filter((row) => !row.problem);
  const choosing = !queue && picked.rows.length === 0;

  const addFiles = (files) => {
    if (files.length === 0) return;
    if (queue) uploads.add(files, items.at(-1).place);
    else setPicked((current) => pickMore(current, files));
  };
  const removePicked = (id) =>
    setPicked((current) => {
      const rows = current.rows.filter((row) => row.id !== id);
      return { rows, leftOut: rows.length > 0 && current.leftOut };
    });
  const send = () => {
    uploads.add(valid.map((row) => row.file), to);
    setPicked(NOTHING_PICKED);
  };
  const browse = () => inputRef.current.click();

  const { over, dropProps } = useFileDrop({ onFiles: addFiles, disabled: Boolean(block) });
  useKeepFilesOut();

  // The control that had focus is gone when the view changes or a row is removed.
  const rowCount = queue ? items.length : picked.rows.length;
  useEffect(() => {
    focusRef.current?.focus({ preventScroll: true });
  }, [queue, rowCount]);

  const addMore = (
    <button type="button" className={`upload-more${over ? " is-over" : ""}`} disabled={Boolean(block)} onClick={browse}>
      <Plus size={18} aria-hidden="true" />
      <strong>Add more files</strong>
      <span className="upload-drag-only">or drop them here</span>
    </button>
  );

  return (
    <>
      <Modal
        sheet
        className="upload-dialog"
        title={queue ? queueTitle(items) : "Upload files"}
        subtitle={queue ? queueSubtitle(items, options) : "Add notes, handouts and photos. You can move them later."}
        initialFocusRef={focusRef}
        onClose={onClose}
        actions={
          queue ? (
            <>
              <p className="upload-dialog__note">You can close this. Uploads keep going.</p>
              <Button ref={focusRef} onClick={onClose}>Close</Button>
            </>
          ) : (
            <>
              <Button variant={phone ? "ghost" : "secondary"} onClick={onClose}>Cancel</Button>
              <Button ref={choosing ? undefined : focusRef} disabled={valid.length === 0 || Boolean(block)} onClick={send}>
                {valid.length > 0 ? `Upload ${filesText(valid.length)}` : "Upload"}
              </Button>
            </>
          )
        }
        {...dropProps}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept={FILE_ACCEPT}
          onChange={(event) => {
            addFiles([...event.target.files]);
            event.target.value = "";
          }}
        />
        {block && <FilesNotice icon={block.icon}>{block.message}</FilesNotice>}

        {queue ? (
          <>
            <ul className="upload-list">
              {items.map((item) => (
                <UploadRow
                  key={item.key}
                  name={item.name}
                  ext={item.ext}
                  size={item.size}
                  status={item.status}
                  progress={item.progress}
                  error={item.error}
                  retryable={item.retryable}
                  onRemove={() => uploads.dismiss(item.key)}
                  onRetry={() => uploads.retry(item.key)}
                />
              ))}
            </ul>
            {addMore}
            <p className="sr-only" role="status">
              {items.filter((item) => item.status === "done").length} of {items.length} uploaded
            </p>
          </>
        ) : (
          <>
            {choosing ? (
              <div className={`upload-zone${over ? " is-over" : ""}`}>
                <span className="upload-zone__icon">
                  <Upload size={28} aria-hidden="true" />
                </span>
                <p className="upload-zone__title upload-drag-only">Drag files here</p>
                <p className="upload-zone__or upload-drag-only">or</p>
                <Button ref={focusRef} disabled={Boolean(block)} onClick={browse}>Browse files</Button>
                <p className="upload-zone__hint">
                  PDF, Word, PowerPoint, Excel, text or photos. Up to {formatSize(MAX_FILE_BYTES)} each.
                </p>
              </div>
            ) : (
              <>
                <ul className="upload-list">
                  {picked.rows.map(({ id, file, problem }) => (
                    <UploadRow
                      key={id}
                      name={file.name}
                      ext={extensionOf(file.name)}
                      size={file.size}
                      status={problem ? "problem" : "picked"}
                      error={problem}
                      onRemove={() => removePicked(id)}
                    />
                  ))}
                </ul>
                {picked.leftOut && (
                  <p className="upload-dialog__left">{`Only the first ${MAX_PICK} were added. You can upload ${MAX_PICK} at a time.`}</p>
                )}
                {addMore}
              </>
            )}
            <Field label="Save to" className="upload-where">
              {(wiring) => (
                <div className="upload-where__row">
                  <SelectButton options={saveToOptions} value={to} onChange={choosePlace} {...wiring} />
                  {usage && <p className="upload-where__usage">{usageText(usage)} used</p>}
                </div>
              )}
            </Field>
          </>
        )}
      </Modal>
      {naming && <FolderDialog onClose={() => setNaming(false)} onSaved={folderCreated} />}
    </>
  );
}
