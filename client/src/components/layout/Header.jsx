import { Link, useLocation } from 'react-router-dom';
import { Bell, CalendarDays, BookOpenCheck, CircleHelp, House, Users, LogOut } from 'lucide-react';
import { useAuth } from '../../pages/authentication/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useGuide } from '../../context/guideState';
import UserAvatar from '../UserAvatar';
import Logo from '../../assets/logo.png';

// The main places in the app (frontend-plan.md section 5). `match` decides when a place is the
// current one, so related pages (Wellbeing under Today, /friends under People) keep it lit.
// Profile isn't one of them: it sits with Notifications and Sign out (sidebar footer, phone top bar).
const PLACES = [
  { key: 'today', label: 'Today', Icon: House, to: () => '/dashboard', match: (p) => p === '/dashboard' || p === '/wellbeing' },
  { key: 'schedule', label: 'Schedule', Icon: CalendarDays, to: () => '/schedule', match: (p) => p === '/schedule' },
  { key: 'study', label: 'Study', Icon: BookOpenCheck, to: () => '/reviewers', match: (p) => p === '/reviewers' },
  { key: 'people', label: 'People', Icon: Users, to: () => '/groups', match: (p) => p === '/groups' || p === '/friends' },
];

function BellLink({ unreadCount, active }) {
  return (
    <Link
      to="/notifications"
      className={`bell-link ${active ? 'active' : ''}`}
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      aria-current={active ? 'page' : undefined}
    >
      <Bell size={20} aria-hidden="true" />
      {unreadCount > 0 && (
        <span className="nav-badge" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>
      )}
    </Link>
  );
}

export default function Header() {
  const { user, logout, isLoggedin } = useAuth();
  const { unreadCount } = useNotifications();
  const { pathname } = useLocation();
  const { tour, isOpen: guideOpen, toggle: toggleGuide } = useGuide();

  // A simple top bar with just the logo on the login/register pages
  if (!isLoggedin) {
    return (
      <header className="header-auth">
        <Link to="/" className="logo-link">
          <img src={Logo} alt="" className="logo-svg" />
          <div className="logo-text">Stress<span>Care</span></div>
        </Link>
      </header>
    );
  }

  const profileTarget = user?._id ? `/profile/${user._id}` : '/profile';
  // Only your own profile lights it up, not another student's.
  const onProfile = pathname === profileTarget || pathname === '/settings';
  const onNotifications = pathname === '/notifications';

  return (
    <>
      {/* Laptop: left sidebar */}
      <aside className="sidepanel">
        <div className="sidepanel-logo">
          <Link to="/dashboard" className="logo-link">
            <img src={Logo} alt="" className="logo-svg" />
            <div className="logo-text">Stress<span>Care</span></div>
          </Link>
        </div>

        <nav className="sidepanel-nav" aria-label="Main">
          <div className="sidepanel-menu">
            {PLACES.map((place) => {
              const { key, label, to, match } = place;
              const Icon = place.Icon;
              const active = match(pathname);
              return (
                <Link
                  key={key}
                  to={to(user)}
                  className={`sidepanel-link ${active ? 'active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={20} aria-hidden="true" /> <span>{label}</span>
                </Link>
              );
            })}
          </div>

          <div className="sidepanel-footer">
            {tour && (
              <button
                type="button"
                className={`sidepanel-link sidepanel-guide ${guideOpen ? 'is-open' : ''}`}
                onClick={toggleGuide}
                aria-expanded={guideOpen}
                aria-label={`Guide, how the ${tour.title} page works`}
                data-guide-trigger
              >
                <CircleHelp size={20} aria-hidden="true" /> <span>Guide</span>
              </button>
            )}
            <Link
              to="/notifications"
              className={`sidepanel-link ${onNotifications ? 'active' : ''}`}
              aria-current={onNotifications ? 'page' : undefined}
            >
              <Bell size={20} aria-hidden="true" /> <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="nav-badge" aria-label={`${unreadCount} unread`}>{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </Link>
            <Link
              to={profileTarget}
              className={`sidepanel-link sidepanel-profile ${onProfile ? 'active' : ''}`}
              aria-current={onProfile ? 'page' : undefined}
            >
              <UserAvatar name={user?.name} src={user?.avatar} size={28} /> <span>Profile</span>
            </Link>
            <button type="button" onClick={logout} className="sidepanel-logout">
              <LogOut size={16} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Phone: top bar and bottom bar */}
      <header className="topbar">
        <Link to="/dashboard" className="logo-link" aria-label="StressCare, go to Today">
          <img src={Logo} alt="" className="logo-svg" />
          <div className="logo-text">Stress<span>Care</span></div>
        </Link>
        <div className="topbar-actions">
          {tour && (
            <button
              type="button"
              className={`icon-action ${guideOpen ? 'is-active' : ''}`}
              onClick={toggleGuide}
              aria-expanded={guideOpen}
              aria-label={`Guide, how the ${tour.title} page works`}
              data-guide-trigger
            >
              <CircleHelp size={20} aria-hidden="true" />
            </button>
          )}
          <BellLink unreadCount={unreadCount} active={onNotifications} />
          <Link
            to={profileTarget}
            className={`topbar-avatar ${onProfile ? 'active' : ''}`}
            aria-label="Profile"
            aria-current={onProfile ? 'page' : undefined}
          >
            <UserAvatar name={user?.name} src={user?.avatar} size={32} />
          </Link>
        </div>
      </header>

      <nav className="bottombar" aria-label="Main">
        {PLACES.map((place) => {
          const { key, label, to, match } = place;
          const Icon = place.Icon;
          const active = match(pathname);
          return (
            <Link
              key={key}
              to={to(user)}
              className={`bottombar-link ${active ? 'active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={22} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
