import { lazy, Suspense, useState } from "react";
import { Bell } from "lucide-react";
import { IconButton } from "@/shared/ui";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import GlobalAddButton from "./add/GlobalAddButton";
import AvatarMenu from "./AvatarMenu";
import HeaderSearch from "./HeaderSearch";
import { useUnread } from "./unreadContext";

const NotificationsDrawer = lazy(() => import("@/features/notifications/NotificationsDrawer"));

// The right side of every page header: the global Add, the search, the bell with the unread count, then the avatar menu.
// From 1024px the bell opens the notifications drawer; on a phone it is a link to the Notifications page.
export default function HeaderTools() {
  const { total } = useUnread();
  const wide = useMediaQuery("(min-width: 1024px)");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const label = total > 0 ? `Notifications, ${total} unread` : "Notifications";

  return (
    <div className="shell-header__tools">
      <GlobalAddButton />
      <HeaderSearch />
      {wide ? (
        <IconButton
          icon={Bell}
          label={label}
          badge={total}
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        />
      ) : (
        <IconButton to="/notifications" icon={Bell} label={label} badge={total} />
      )}
      <AvatarMenu />
      {wide && drawerOpen && (
        <Suspense fallback={null}>
          <NotificationsDrawer onClose={() => setDrawerOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
