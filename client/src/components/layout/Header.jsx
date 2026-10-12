import { Link, useLocation } from 'react-router-dom';
import { Bell, CalendarDays, BookOpenCheck, House, Users, CircleUser, LogOut } from 'lucide-react';
import { useAuth } from '../../pages/authentication/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import UserAvatar from '../UserAvatar';
import Logo from '../../assets/logo.svg';

// The five places in the app (frontend-plan.md section 5). `match` decides when a place is the
// current one, so related pages (Wellbeing under Today, /friends under People) keep it lit.
const PLACES = [
  { key: 'today', label: 'Today', Icon: House, to: () => '/dashboard', match: (p) => p === '/dashboard' || p === '/wellbeing' },
  { key: 'schedule', label: 'Schedule', Icon: CalendarDays, to: () => '/schedule', match: (p) => p === '/schedule' },
  { key: 'study', label: 'Study', Icon: BookOpenCheck, to: () => '/reviewers', match: (p) => p === '/reviewers' },
  { key: 'people', label: 'People', Icon: Users, to: () => '/groups', match: (p) => p === '/groups' || p === '/friends' },
  { key: 'me', label: 'Me', Icon: CircleUser, to: (user) => (user?._id ? `/profile/${user._id}` : '/profile'), match: (p) => p.startsWith('/profile') || p === '/settings' },
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

  // A simple top bar with just the logo on the login/register pages
  if (!isLoggedin) {
    return (
      <header className="header-auth">
        <Link to="/" className="logo-link">
          <img src={Logo} alt="StressCare Logo" className="logo-svg" />
          <div>Stress<span>Care</span></div>
        </Link>
      </header>
    );
  }

  const firstName = user?.name?.split(' ')[0] || 'Student';
  const meTarget = PLACES[4].to(user);
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
                  <Icon size={19} aria-hidden="true" /> <span>{label}</span>
                </Link>
              );
            })}
          </div>

          <div className="sidepanel-footer">
            <Link
              to="/notifications"
              className={`sidepanel-link ${onNotifications ? 'active' : ''}`}
              aria-current={onNotifications ? 'page' : undefined}
            >
              <Bell size={19} aria-hidden="true" /> <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="nav-badge" aria-label={`${unreadCount} unread`}>{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </Link>
            <Link to={meTarget} className="sidepanel-user" title="Open Me">
              <UserAvatar name={user?.name} src={user?.avatar} size={32} />
              <span className="user-name">{firstName}</span>
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
          <BellLink unreadCount={unreadCount} active={onNotifications} />
          <Link to={meTarget} className="topbar-avatar" aria-label="Open Me">
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
