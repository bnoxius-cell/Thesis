import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { IconButton, Menu, MenuItem } from "@/shared/ui";

// The More menu on a subject card: Edit and Delete.
export default function SubjectMenu({ subject, onEdit, onDelete }) {
  return (
    <Menu
      align="end"
      label={`Actions for ${subject.name}`}
      className="study-more"
      trigger={(props) => <IconButton plain icon={MoreHorizontal} label={`More for ${subject.name}`} {...props} />}
    >
      <MenuItem icon={Pencil} onSelect={() => onEdit(subject)}>Edit</MenuItem>
      <MenuItem icon={Trash2} tone="danger" onSelect={() => onDelete(subject)}>Delete</MenuItem>
    </Menu>
  );
}
