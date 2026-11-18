import { Archive, MoreHorizontal, Pencil, RotateCcw, Share, Trash2 } from "lucide-react";
import { IconButton, Menu, MenuItem } from "@/shared/ui";

// The More menu on a subject card or in the Subject page header: Edit, then Archive (or Restore, for an archived
// subject), Share (active subjects only) and Delete. A row shows only when its handler is passed. `className` places it (the card corner by default).
export default function SubjectMenu({ subject, onEdit, onArchive, onRestore, onShare, onDelete, className = "study-more" }) {
  return (
    <Menu
      align="end"
      label={`Actions for ${subject.name}`}
      className={className}
      trigger={(props) => <IconButton plain icon={MoreHorizontal} label={`More for ${subject.name}`} {...props} />}
    >
      <MenuItem icon={Pencil} onSelect={() => onEdit(subject)}>Edit</MenuItem>
      {!subject.archivedAt && onArchive && <MenuItem icon={Archive} onSelect={() => onArchive(subject)}>Archive</MenuItem>}
      {subject.archivedAt && onRestore && <MenuItem icon={RotateCcw} onSelect={() => onRestore(subject)}>Restore</MenuItem>}
      {!subject.archivedAt && onShare && <MenuItem icon={Share} onSelect={() => onShare(subject)}>Share to a group</MenuItem>}
      <MenuItem icon={Trash2} tone="danger" onSelect={() => onDelete(subject)}>Delete</MenuItem>
    </Menu>
  );
}
