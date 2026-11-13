import { useState } from "react";
import { toast } from "react-toastify";
import { LogOut, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { IconButton, Menu, MenuItem } from "@/shared/ui";
import RenameTimetableDialog from "./RenameTimetableDialog";
import TimetableConfirmDialog from "./TimetableConfirmDialog";
import "./timetable-menu.css";

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
        trigger={(props) => <IconButton plain icon={MoreHorizontal} label="More for this timetable" {...props} />}
      >
        {owner ? (
          <>
            <MenuItem icon={Pencil} onSelect={() => setDialog("rename")}>Rename</MenuItem>
            <MenuItem icon={Trash2} tone="danger" onSelect={() => setDialog("delete")}>Delete</MenuItem>
          </>
        ) : (
          <MenuItem icon={LogOut} tone="danger" onSelect={() => setDialog("leave")}>Leave</MenuItem>
        )}
      </Menu>
      {dialog === "rename" && <RenameTimetableDialog timetable={timetable} onClose={close} onRenamed={renamed} />}
      {(dialog === "delete" || dialog === "leave") && (
        <TimetableConfirmDialog mode={dialog} timetable={timetable} userId={userId} onClose={close} onDone={removed} />
      )}
    </>
  );
}
