import { Bell } from "lucide-react";
import { IconButton } from "@/shared/ui";
import AvatarMenu from "./AvatarMenu";
import { useUnread } from "./unreadContext";

// The right side of every page header: the bell with the unread count, then the avatar menu.
export default function HeaderTools() {
  const { total } = useUnread();
  return (
    <div className="shell-header__tools">
      <IconButton
        to="/notifications"
        icon={Bell}
        label={total > 0 ? `Notifications, ${total} unread` : "Notifications"}
        badge={total}
      />
      <AvatarMenu />
    </div>
  );
}
