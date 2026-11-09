import { fileKind } from "@/features/files/fileKinds";
import { formatSize } from "@/shared/lib/formatSize";
import { canPickStored, sourceCounter } from "./reviewerForm";
import "@/features/files/upload-dialog.css";

// The "Subject files" half of the Source field in New reviewer: the subject's stored files as
// checkboxes, so nothing is uploaded again. `files` are the usable ones, `pickedIds` the ticked ones.
// Once 10 files or 20 MB are ticked, the rest are dimmed and can't be ticked until one is cleared.
export default function StoredFilesPicker({ files, pickedIds, onToggle, disabled = false, describedBy }) {
  const picked = files.filter((file) => pickedIds.includes(file.id));

  return (
    <div className="study-source">
      <ul className="upload-list" aria-label="Subject files">
        {files.map((file) => {
          const checked = pickedIds.includes(file.id);
          const full = !checked && !canPickStored(picked, file);
          const { Icon, label } = fileKind(file.ext);
          return (
            <li key={file.id}>
              <label className={`upload-row study-stored${full ? " is-full" : ""}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled || full}
                  aria-describedby={describedBy}
                  onChange={() => onToggle(file.id)}
                />
                <span className="upload-row__tile">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="upload-row__info">
                  <span className="upload-row__name" title={file.name}>{file.name}</span>
                  <span className="upload-row__meta">{`${label} · ${formatSize(file.size)}`}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="study-source__count" role="status">
        {picked.length ? sourceCounter(picked) : "Tick the files to use."}
      </p>
    </div>
  );
}
