import { LifeBuoy, LogOut, Settings, User } from "lucide-react";
import { useAuth } from "@/pages/authentication/AuthContext";
import { Avatar, Menu, MenuDivider, MenuItem } from "@/shared/ui";

// The student's menu in the page header (Figma 20:68): who is signed in, then Profile, Settings,
// Help and contacts, and Log out. Log out is a plain row, not red: signing out is not a danger.
// Focus returns to the picture when the menu closes by keyboard.
export default function AvatarMenu() {
  const { userData, logout } = useAuth();
  const name = userData?.name || "Student";

  return (
    <Menu
      align="end"
      label="Your account"
      trigger={(props) => (
        <button type="button" className="shell-avatar-btn" aria-label="Your account" {...props}>
          <Avatar name={name} src={userData?.avatar} />
        </button>
      )}
    >
      <div className="shell-account" role="presentation">
        <Avatar name={name} src={userData?.avatar} />
        <div className="shell-account__who">
          <p className="shell-account__name">{name}</p>
          <p className="shell-account__role">Student account</p>
        </div>
      </div>
      <MenuDivider />
      <MenuItem to="/me" icon={User}>Profile</MenuItem>
      <MenuItem to="/me/settings" icon={Settings}>Settings</MenuItem>
      <MenuItem to="/me/help" icon={LifeBuoy}>Help and contacts</MenuItem>
      <MenuDivider />
      <MenuItem icon={LogOut} onSelect={() => logout()}>Log out</MenuItem>
    </Menu>
  );
}
