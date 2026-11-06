import { ExternalLink, MoreHorizontal, Trash2 } from "lucide-react";
import { IconButton, Menu, MenuItem } from "@/shared/ui";
import FileThumb from "./FileThumb";
import { addedText, fileKind, formatSize, isPhoto } from "./fileKinds";

// One file (Figma 151:2210, 157:1747): its icon or, for a photo, a small preview; name; "PDF · 2.1 MB ·
// added 2 days ago"; and a More menu. The name area opens the file. `entering` eases a row in after
// an upload; `leaving` collapses it after a delete and calls `onGone` when it has gone.
export default function FileRow({ file, now, entering, leaving, onOpen, onDelete, onGone }) {
  const { Icon, label } = fileKind(file.ext);

  return (
    <li
      className={`files-item${entering ? " is-entering" : ""}${leaving ? " is-leaving" : ""}`}
      onTransitionEnd={(event) => {
        if (leaving && event.target === event.currentTarget && event.propertyName === "opacity") onGone(file.id);
      }}
    >
      <div className="files-item__clip">
        <div className="files-row">
          <button type="button" className="files-row__open" onClick={() => onOpen(file)}>
            {isPhoto(file.ext) ? <FileThumb file={file} /> : <Icon size={20} className="files-row__icon" aria-hidden="true" />}
            <span className="files-row__text">
              <strong className="files-row__name">{file.name}</strong>
              <span className="files-row__meta">
                {label} · {formatSize(file.size)} · <span className="files-row__added">added </span>
                {addedText(file.createdAt, now)}
              </span>
            </span>
          </button>
          <Menu
            align="end"
            label={`Actions for ${file.name}`}
            trigger={(props) => <IconButton plain icon={MoreHorizontal} label={`More for ${file.name}`} {...props} />}
          >
            <MenuItem icon={ExternalLink} onSelect={() => onOpen(file)}>Open</MenuItem>
            <MenuItem icon={Trash2} tone="danger" onSelect={() => onDelete(file)}>Delete</MenuItem>
          </Menu>
        </div>
      </div>
    </li>
  );
}
