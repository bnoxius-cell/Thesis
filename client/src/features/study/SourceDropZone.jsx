import { useEffect, useId, useRef } from "react";
import { Plus } from "lucide-react";
import useFileDrop from "@/shared/hooks/useFileDrop";
import UploadRow from "@/features/files/UploadRow";
import { extensionOf } from "@/features/files/fileRules";
import { formatSize } from "@/shared/lib/formatSize";
import { MAX_SOURCES, MAX_SOURCES_BYTES, SOURCE_ACCEPT, sourceCounter } from "./reviewerForm";
import "@/features/files/upload-dialog.css";

// The upload half of the Source field in New reviewer (Figma 78:1410 for the empty zone): a dashed
// zone you drop files on or click to choose from. Once files are added they show as rows (the
// Files upload dialog's UploadRow) with a counter and an "Add more" bar. `entries` is the list
// ([{ id, file }]); `onAdd` gets the dropped or chosen files as an array, and checking them is the
// form's job. The zone is a label around a real file input, so it works with the keyboard and a
// screen reader. Dragging over it lifts it a little and tints it; nothing happens while `disabled`.
export default function SourceDropZone({ entries, onAdd, onRemove, disabled = false, describedBy }) {
  const inputId = useId();
  const inputRef = useRef(null);
  const addRef = useRef(null);
  const removed = useRef(false);
  const { over, dropProps } = useFileDrop({ onFiles: onAdd, disabled });
  const filled = entries.length > 0;

  // A removed row takes the keyboard's place with it: move focus to what is left to press.
  useEffect(() => {
    if (!removed.current) return;
    removed.current = false;
    (addRef.current ?? inputRef.current)?.focus({ preventScroll: true });
  }, [entries.length]);

  const input = (
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      multiple
      accept={SOURCE_ACCEPT}
      className="study-drop__input"
      tabIndex={filled ? -1 : undefined}
      disabled={disabled}
      aria-describedby={describedBy}
      onChange={(event) => {
        onAdd([...event.target.files]);
        event.target.value = "";
      }}
    />
  );

  if (!filled) {
    return (
      <div className={`study-drop${over ? " is-over" : ""}`} {...dropProps}>
        {input}
        <label htmlFor={inputId} className="study-drop__prompt">
          <strong>Drop files here or choose files</strong>
          <span>PDF, Word, PowerPoint or photos. Up to {formatSize(MAX_SOURCES_BYTES)}.</span>
        </label>
      </div>
    );
  }

  return (
    <div className="study-source" {...dropProps}>
      {input}
      <ul className="upload-list">
        {entries.map(({ id, file }) => (
          <UploadRow
            key={id}
            name={file.name}
            ext={extensionOf(file.name)}
            size={file.size}
            status="picked"
            onRemove={() => {
              removed.current = true;
              onRemove(id);
            }}
          />
        ))}
      </ul>
      <p className="study-source__count" role="status">{sourceCounter(entries.map((entry) => entry.file))}</p>
      {entries.length < MAX_SOURCES && (
        <button
          ref={addRef}
          type="button"
          className={`upload-more${over ? " is-over" : ""}`}
          disabled={disabled}
          onClick={() => inputRef.current.click()}
        >
          <Plus size={18} aria-hidden="true" />
          <strong>Add more files</strong>
          <span className="upload-drag-only">or drop them here</span>
        </button>
      )}
    </div>
  );
}
