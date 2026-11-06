import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { IconButton, Menu, MenuItem } from "@/shared/ui";

// The More menu on a subject card or in the Subject page header: Edit and Delete. `className` places
// it (the card corner by default).
export default function SubjectMenu({ subject, onEdit, onDelete, className = "study-more" }) {
  return (
    <Menu
      align="end"
      label={`Actions for ${subject.name}`}
      className={className}
      trigger={(props) => <IconButton plain icon={MoreHorizontal} label={`More for ${subject.name}`} {...props} />}
    >
      <MenuItem icon={Pencil} onSelect={() => onEdit(subject)}>Edit</MenuItem>
      <MenuItem icon={Trash2} tone="danger" onSelect={() => onDelete(subject)}>Delete</MenuItem>
    </Menu>
  );
}
