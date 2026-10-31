import { useId, useRef, useState } from "react";
import { FileText, FileUp } from "lucide-react";
import { Button } from "@/shared/ui";
import { MAX_PDF_MB, formatBytes } from "./reviewerForm";

// The Source field of New reviewer (Figma 78:1410): a dashed zone you drop a PDF on or click to
// choose from. `onPick` gets the file; checking it is the form's job. The zone is a label around a
// real file input, so it works with the keyboard and a screen reader. Dragging over it lifts it a
// little and tints it; nothing happens while `disabled`.
export default function PdfDropZone({ file, onPick, disabled = false, describedBy }) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  const pick = (picked) => {
    if (picked && !disabled) onPick(picked);
  };
  const leave = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOver(false);
  };

  return (
    <div
      className={`study-drop${over ? " is-over" : ""}${file ? " has-file" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={leave}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        pick(event.dataTransfer.files?.[0]);
      }}
    >
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="application/pdf,.pdf"
        className="study-drop__input"
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(event) => {
          pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {file ? (
        <div className="study-drop__file">
          <FileText size={20} aria-hidden="true" />
          <span className="study-drop__name">
            <strong>{file.name}</strong>
            <small>{formatBytes(file.size)}</small>
          </span>
          <Button variant="secondary" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
            Change
          </Button>
        </div>
      ) : (
        <label htmlFor={inputId} className="study-drop__prompt">
          <FileUp size={20} aria-hidden="true" />
          <strong>Drop a PDF here or choose a file</strong>
          <span>Up to {MAX_PDF_MB} MB.</span>
        </label>
      )}
    </div>
  );
}
