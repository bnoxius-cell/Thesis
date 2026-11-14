import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { IconButton, Menu, MenuItem } from "@/shared/ui";

// One card (Figma 260:908): the term over its answer, and a More menu with Edit and Delete. The answer keeps
// the student's line breaks. `entering` eases the row in after an add.
export default function CardRow({ card, entering, onEdit, onDelete }) {
  return (
    <li className={`deck-card${entering ? " is-entering" : ""}`}>
      <div className="deck-card__text">
        <h3 className="deck-card__term">{card.term}</h3>
        <p className="deck-card__answer">{card.answer}</p>
      </div>
      <Menu
        align="end"
        label={`Actions for ${card.term}`}
        trigger={(props) => <IconButton plain icon={MoreHorizontal} label={`More for ${card.term}`} {...props} />}
      >
        <MenuItem icon={Pencil} onSelect={onEdit}>Edit</MenuItem>
        <MenuItem icon={Trash2} tone="danger" onSelect={onDelete}>Delete</MenuItem>
      </Menu>
    </li>
  );
}
