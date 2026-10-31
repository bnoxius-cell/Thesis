import { useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Logo from "@/assets/logo.png";
import { useAuth } from "@/pages/authentication/AuthContext";
import { Badge } from "@/shared/ui";
import { ALL_ITEMS, NAV_GROUPS, SETTINGS_ITEM } from "./navItems";
import { useUnread } from "./unreadContext";
import useNavPill from "./useNavPill";
import "./sidebar.css";

function NavLink({ item, active, count, collapsed }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        to={item.to}
        className="shell-nav__link"
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
      >
        <Icon size={20} aria-hidden="true" />
        <span className="shell-nav__label">{item.label}</span>
        <Badge count={count} className="shell-nav__badge" />
        {count > 0 && <span className="shell-nav__dot" aria-hidden="true" />}
        {count > 0 && <span className="sr-only">, {count} {item.badgeNoun}</span>}
      </Link>
    </li>
  );
}

// Sidebar v2 (Figma 16:3): the places in the app in groups, Settings, Log out and Collapse at the
// bottom. Collapse turns it into a 72px icon rail (labels stay for screen readers, a badge becomes
// a dot). Shown from 1024px; below that the phone bars (F5) take over.
export default function Sidebar({ collapsed, onToggle }) {
  const { logout } = useAuth();
  const unread = useUnread();
  const location = useLocation();
  const body = useRef(null);
  const pill = useNavPill(body);
  const activeKey = ALL_ITEMS.find((item) => item.isActive(location))?.key;

  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const link = (item) => (
    <NavLink key={item.key} item={item} active={item.key === activeKey} count={item.badge ? unread[item.badge] : 0} collapsed={collapsed} />
  );

  return (
    <aside className="shell-sidebar" data-collapsed={collapsed || undefined}>
      <Link to="/home" className="shell-sidebar__logo" aria-label="StressCare home" title={collapsed ? "StressCare home" : undefined}>
        <img src={Logo} alt="" width="28" height="28" />
        <span aria-hidden="true">StressCare</span>
      </Link>

      <div ref={body} className="shell-sidebar__body">
        <span
          className="shell-nav__pill"
          data-ready={pill.ready || undefined}
          data-visible={pill.visible || undefined}
          style={{ height: pill.height, transform: `translateY(${pill.y}px)` }}
          aria-hidden="true"
        />
        <nav aria-label="Main" id="shell-sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.key} className="shell-nav__group">
              {group.label && (
                <p className="shell-nav__eyebrow" id={`nav-${group.key}`}>{group.label}</p>
              )}
              <ul aria-labelledby={group.label ? `nav-${group.key}` : undefined}>{group.items.map(link)}</ul>
            </div>
          ))}
        </nav>
        <ul className="shell-nav__foot">
          {link(SETTINGS_ITEM)}
          <li>
            <button type="button" className="shell-nav__link" onClick={() => logout()} title={collapsed ? "Log out" : undefined}>
              <LogOut size={20} aria-hidden="true" />
              <span className="shell-nav__label">Log out</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="shell-nav__link shell-nav__link--collapse"
              onClick={onToggle}
              aria-expanded={!collapsed}
              aria-controls="shell-sidebar-nav"
              title={collapsed ? "Expand sidebar" : undefined}
            >
              <CollapseIcon size={20} aria-hidden="true" />
              <span className="shell-nav__label">{collapsed ? "Expand sidebar" : "Collapse"}</span>
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
}
