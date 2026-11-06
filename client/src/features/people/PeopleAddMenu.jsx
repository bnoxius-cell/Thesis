import { Link2, UserPlus, UsersRound } from "lucide-react";
import { AddButton, Menu, MenuItem } from "@/shared/ui";
import "./people-add.css";

// The "+" in the People header (Figma 64:302): New group, Join a group, Add a friend. Add a friend
// opens the Friends tab with `?add=1`, which the Friends pane uses to focus its code field. The
// other two call the handlers that open the page's dialogs.
export default function PeopleAddMenu({ onNewGroup, onJoinGroup }) {
  return (
    <Menu
      label="Add to People"
      menuClassName="people-addmenu"
      trigger={(props) => <AddButton label="Add a group or a friend" {...props} />}
    >
      <MenuItem icon={UsersRound} onSelect={onNewGroup}>New group</MenuItem>
      <MenuItem icon={Link2} onSelect={onJoinGroup}>Join a group</MenuItem>
      <MenuItem icon={UserPlus} to="/people/friends?add=1">Add a friend</MenuItem>
    </Menu>
  );
}
