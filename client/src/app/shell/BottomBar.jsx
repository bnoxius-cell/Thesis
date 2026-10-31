import { Link, useLocation } from "react-router-dom";
import { Badge } from "@/shared/ui";
import { useBottomBarHidden } from "./focusView";
import { PHONE_ITEMS } from "./navItems";
import { useUnread } from "./unreadContext";
import "./bottombar.css";

// The phone's navigation (Figma 52:117): five places, each an icon in a 56x32 pill over a 13px label.
// Shown under 1024px, where the sidebar is not. It hides while a screen asks for the focus view.
export default function BottomBar() {
  const hidden = useBottomBarHidden();
  const unread = useUnread();
  const location = useLocation();
  if (hidden) return null;

  return (
    <nav className="shell-bottombar" aria-label="Main">
      <ul>
        {PHONE_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.isActive(location);
          const count = item.badge ? item.badge(unread) : 0;
          return (
            <li key={item.key}>
              <Link to={item.to} className="shell-tab" aria-current={active ? "page" : undefined}>
                <span className="shell-tab__pill">
                  <Icon size={24} aria-hidden="true" />
                  <Badge count={count} className="shell-tab__badge" />
                </span>
                <span className="shell-tab__label">{item.label}</span>
                {count > 0 && <span className="sr-only">, {count} {item.badgeNoun}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
