import { Bell } from "lucide-react";
import { IconButton } from "@/shared/ui";
import GlobalAddButton from "./add/GlobalAddButton";
import AvatarMenu from "./AvatarMenu";
import HeaderSearch from "./HeaderSearch";
import { useUnread } from "./unreadContext";

// The right side of every page header: the global Add, the search, the bell with the unread count, then the avatar menu.
export default function HeaderTools() {
  const { total } = useUnread();
  return (
    <div className="shell-header__tools">
      <GlobalAddButton />
      <HeaderSearch />
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
