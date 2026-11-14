import { LifeBuoy, LogOut, Settings, Sparkles, User } from "lucide-react";
import { useAuth } from "@/pages/authentication/AuthContext";
import { Avatar, Badge, Menu, MenuDivider, MenuItem } from "@/shared/ui";
import useWhatsNew from "@/features/whats-new/useWhatsNew";

// The student's menu in the page header (Figma 20:68): who is signed in, then Profile, Settings,
// Help and contacts, and Log out. Log out is a plain row, not red: signing out is not a danger.
// Focus returns to the picture when the menu closes by keyboard.
export default function AvatarMenu() {
  const { userData, logout } = useAuth();
  const name = userData?.name || "Student";
  const { hasUnseen } = useWhatsNew();

  return (
    <Menu
      align="end"
      label="Your account"
      menuClassName="shell-menu"
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
      <MenuItem to="/profile" icon={User}>Profile</MenuItem>
      <MenuItem to="/settings" icon={Settings}>Settings</MenuItem>
      <MenuItem to="/settings/help" icon={LifeBuoy}>Help and contacts</MenuItem>
      <MenuItem to="/settings/whats-new" icon={Sparkles} aria-label={hasUnseen ? "What's new, new updates" : undefined}>
        What's new
        {hasUnseen && <Badge dot />}
      </MenuItem>
      <MenuDivider />
      <MenuItem icon={LogOut} onSelect={() => logout()}>Log out</MenuItem>
    </Menu>
  );
}
