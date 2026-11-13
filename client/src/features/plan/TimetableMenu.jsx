import { useState } from "react";
import { toast } from "react-toastify";
import { LogOut, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { IconButton, Menu, MenuItem } from "@/shared/ui";
import "@/app/shell/add/global-add.css";
import RenameTimetableDialog from "./RenameTimetableDialog";
import TimetableConfirmDialog from "./TimetableConfirmDialog";
import "./timetable-menu.css";

// One row of the popover: the Add menu's tile, title and hint, so both menus read the same.
function Row({ icon: Icon, title, hint, tone, onSelect }) {
  return (
    <MenuItem className="global-add__item" tone={tone} onSelect={onSelect}>
      <span className="global-add__tile"><Icon size={20} aria-hidden="true" /></span>
      <span className="global-add__text">
        <span className="global-add__title">{title}</span>
        <span className="global-add__hint">{hint}</span>
      </span>
    </MenuItem>
  );
}

// The More button beside the switcher (Figma D10). The owner renames or deletes; anyone else on the
// timetable can leave. `onChanged` reloads the lists; `onGone` sends the student back to My week.
export default function TimetableMenu({ timetable, userId, onChanged, onGone }) {
  const [dialog, setDialog] = useState(null); // "rename" | "delete" | "leave"
  const owner = timetable.role === "owner";
  const close = () => setDialog(null);

  const renamed = (title) => {
    close();
    toast.success(`Renamed to "${title}".`);
    onChanged();
  };
  const removed = () => {
    close();
    toast.success(dialog === "delete" ? "Timetable deleted." : `You left "${timetable.title}".`);
    onGone();
  };

  return (
    <>
      <Menu
        align="end"
        label={`Actions for ${timetable.title}`}
        className="timetable-menu"
        menuClassName="timetable-menu__popover"
        trigger={(props) => <IconButton plain icon={MoreHorizontal} label="More for this timetable" {...props} />}
      >
        {owner ? (
          <>
            <Row icon={Pencil} title="Rename timetable" hint="Change its name" onSelect={() => setDialog("rename")} />
            <Row icon={Trash2} tone="danger" title="Delete timetable" hint="Removes it for everyone on it" onSelect={() => setDialog("delete")} />
          </>
        ) : (
          <Row icon={LogOut} title="Leave timetable" hint="You keep your own items" onSelect={() => setDialog("leave")} />
        )}
      </Menu>
      {dialog === "rename" && <RenameTimetableDialog timetable={timetable} onClose={close} onRenamed={renamed} />}
      {(dialog === "delete" || dialog === "leave") && (
        <TimetableConfirmDialog mode={dialog} timetable={timetable} userId={userId} onClose={close} onDone={removed} />
      )}
    </>
  );
}
