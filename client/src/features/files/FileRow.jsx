import { useCallback, useEffect, useRef } from "react";
import { ExternalLink, MoreHorizontal, Trash2 } from "lucide-react";
import { Chip, IconButton, Menu, MenuItem } from "@/shared/ui";
import FileThumb from "./FileThumb";
import { formatSize } from "@/shared/lib/formatSize";
import { addedText, fileKind } from "./fileKinds";
import { isPhoto } from "./fileRules";

const LEAVE_MS = 200; // the collapse in files.css

// Calls `onGone` once for a leaving row: when its collapse ends (the returned function, for
// transitionend), shortly after it should have ended, or when the row unmounts first because
// another tab opened. Without the last two a row could stay in the list and in the counts.
function useLeave(id, leaving, onGone) {
  const latest = useRef(onGone);
  useEffect(() => {
    latest.current = onGone;
  });
  const done = useRef(false);
  const gone = useCallback(() => {
    if (done.current) return;
    done.current = true;
    latest.current(id);
  }, [id]);

  useEffect(() => {
    if (!leaving) return undefined;
    const timer = setTimeout(gone, LEAVE_MS + 50);
    return () => {
      clearTimeout(timer);
      gone();
    };
  }, [leaving, gone]);

  return gone;
}

// One file (Figma 151:2210, 157:1747): its icon or, for a photo, a small preview; name; "PDF · 2.1 MB ·
// added 2 days ago"; and a More menu. The name area opens the file. `place` is an optional chip with
// the name of the place it lives in. `entering` eases a row in after an upload; `leaving` collapses it after a delete and calls `onGone` once when it has gone.
export default function FileRow({ file, now, place, entering, leaving, onOpen, onDelete, onGone }) {
  const { Icon, label } = fileKind(file.ext);
  const gone = useLeave(file.id, leaving, onGone);

  return (
    <li
      className={`files-item${entering ? " is-entering" : ""}${leaving ? " is-leaving" : ""}`}
      onTransitionEnd={(event) => {
        if (leaving && event.target === event.currentTarget && event.propertyName === "opacity") gone();
      }}
    >
      <div className="files-item__clip">
        <div className={`files-row${place ? " files-row--placed" : ""}`}>
          <button type="button" className="files-row__open" onClick={() => onOpen(file)}>
            {isPhoto(file.ext) ? <FileThumb file={file} /> : <Icon size={20} className="files-row__icon" aria-hidden="true" />}
            <span className="files-row__text">
              <strong className="files-row__name">{file.name}</strong>
              <span className="files-row__meta">
                {label} · {formatSize(file.size)} · <span className="files-row__added">added </span>
                {addedText(file.createdAt, now)}
              </span>
            </span>
            {place && <Chip className="files-row__place">{place}</Chip>}
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
