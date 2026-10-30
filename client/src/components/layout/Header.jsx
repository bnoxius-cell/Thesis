import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, CalendarDays, BookOpenCheck, CircleHelp, Ellipsis, Heart, House, UserPlus, Users, LogOut } from 'lucide-react';
import { useAuth } from '../../pages/authentication/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useGuide } from '../../context/guideState';
import { sidebarScroll } from './navFocus';
import MoreSheet from './MoreSheet';
import UserAvatar from '../UserAvatar';
import Logo from '../../assets/logo.png';

// The places in the app. `match` decides when a place is the current one. Profile isn't one of them:
// it sits with Notifications and Sign out (sidebar footer, phone top bar and More sheet).
// `badge` names the unread count from NotificationContext that belongs to the place.
const MAIN_PLACES = [
  { key: 'today', label: 'Today', Icon: House, to: '/home', match: (p) => p === '/home' },
  { key: 'schedule', label: 'Schedule', Icon: CalendarDays, to: '/plan', match: (p) => p === '/plan' },
  { key: 'wellbeing', label: 'Wellbeing', Icon: Heart, to: '/wellbeing', match: (p) => p === '/wellbeing' },
  { key: 'study', label: 'Study', Icon: BookOpenCheck, to: '/study', match: (p) => p === '/study' || p.startsWith('/study/') },
];
// People shows Groups, or Friends with `?tab=friends`. Another student's profile (/people/<id>) belongs to Friends.
const onFriendsTab = (search) => new URLSearchParams(search).get('tab') === 'friends';
const PEOPLE_PLACES = [
  { key: 'groups', label: 'Groups', Icon: Users, to: '/people', badge: 'groupsUnread', badgeLabel: 'unread chats', match: (p, search) => p === '/people' && !onFriendsTab(search) },
  {
    key: 'friends', label: 'Friends', Icon: UserPlus, to: '/people?tab=friends', badge: 'friendsUnread', badgeLabel: 'friend requests',
    match: (p, search) => (p === '/people' && onFriendsTab(search)) || p.startsWith('/people/'),
  },
];
// The phone bottom bar: four places, then More (Wellbeing and Friends live in the More sheet).
const BOTTOM_PLACES = [MAIN_PLACES[0], MAIN_PLACES[1], MAIN_PLACES[3], PEOPLE_PLACES[0]];
const MORE_PATHS = ['/wellbeing', '/about'];

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

function SidebarLink({ place, pathname, search, counts }) {
  const { label, to, match, badge, badgeLabel } = place;
  const Icon = place.Icon;
  const active = match(pathname, search);
  const count = badge ? counts[badge] : 0;
  return (
    <Link to={to} className={`sidepanel-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
      <Icon size={20} aria-hidden="true" /> <span>{label}</span>
      {count > 0 && <span className="nav-badge" aria-label={`${count} ${badgeLabel}`}>{count > 99 ? '99+' : count}</span>}
    </Link>
  );
}

export default function Header() {
  const { user, logout, isLoggedin } = useAuth();
  const { unreadCount, groupsUnread, friendsUnread } = useNotifications();
  const counts = { groupsUnread, friendsUnread };
  const { pathname, search } = useLocation();
  const { tour, isOpen: guideOpen, toggle: toggleGuide } = useGuide();
  const asideRef = useRef(null);
  const [moreOpen, setMoreOpen] = useState(false);

  // Each page renders its own sidebar; keep it scrolled where it was (matters on short windows).
  useLayoutEffect(() => {
    if (asideRef.current) asideRef.current.scrollTop = sidebarScroll.top;
  }, []);

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
  const onMore = MORE_PATHS.includes(pathname) || PEOPLE_PLACES[1].match(pathname, search);

  return (
    <>
      {/* Laptop: left sidebar */}
      <aside className="sidepanel" ref={asideRef} onScroll={(e) => { sidebarScroll.top = e.currentTarget.scrollTop; }}>
        <div className="sidepanel-logo">
          <Link to="/home" className="logo-link">
            <img src={Logo} alt="" className="logo-svg" />
            <div className="logo-text">Stress<span>Care</span></div>
          </Link>
        </div>

        <nav className="sidepanel-nav" aria-label="Main">
          <div className="sidepanel-menu">
            {MAIN_PLACES.map((place) => (
              <SidebarLink key={place.key} place={place} pathname={pathname} search={search} counts={counts} />
            ))}
            <div className="sidepanel-section">People</div>
            {PEOPLE_PLACES.map((place) => (
              <SidebarLink key={place.key} place={place} pathname={pathname} search={search} counts={counts} />
            ))}
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
        <Link to="/home" className="logo-link" aria-label="StressCare, go to Today">
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
        {BOTTOM_PLACES.map((place) => {
          const { key, label, to, match, badge, badgeLabel } = place;
          const Icon = place.Icon;
          const active = match(pathname, search);
          const count = badge ? counts[badge] : 0;
          return (
            <Link
              key={key}
              to={to}
              className={`bottombar-link ${active ? 'active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="bottombar-icon">
                <Icon size={22} aria-hidden="true" />
                {count > 0 && <span className="nav-badge" aria-label={`${count} ${badgeLabel}`}>{count > 99 ? '99+' : count}</span>}
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className={`bottombar-link ${onMore ? 'active' : ''}`}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-current={onMore ? 'page' : undefined}
          aria-label={friendsUnread > 0 ? `More, ${friendsUnread} friend ${friendsUnread === 1 ? 'request' : 'requests'}` : 'More'}
        >
          <span className="bottombar-icon">
            <Ellipsis size={22} aria-hidden="true" />
            {friendsUnread > 0 && <span className="nav-dot" aria-hidden="true" />}
          </span>
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <MoreSheet
          onClose={() => setMoreOpen(false)}
          user={user}
          profileTarget={profileTarget}
          friendsUnread={friendsUnread}
          unreadCount={unreadCount}
          onLogout={logout}
        />
      )}
    </>
  );
}
