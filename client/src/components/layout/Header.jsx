import { useState } from 'react';
import { useAuth } from "../../pages/authentication/AuthContext";
import { LogOut, UserCircle, User, Plus, Info, Settings, Users, UserCheck, Bell, LayoutDashboard, Menu } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import Logo from '../../assets/logo.svg'; // Assuming you create this file

export default function Header() {
  const { user, logout, isLoggedin } = useAuth();
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);
  const closeDrawer = () => setExpanded(false);

  // Show a simple top bar with just the logo on the login/register pages
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

  return (
    <>
      {expanded && <div className="sidepanel-backdrop" onClick={closeDrawer} />}
      <aside className={`sidepanel ${expanded ? 'expanded' : ''}`}>
        <div className="sidepanel-logo">
          <Link to="/" className="logo-link" onClick={closeDrawer}>
            <img src={Logo} alt="StressCare Logo" className="logo-svg" />
            <div className="logo-text">Stress<span>Care</span></div>
          </Link>
          <button
            type="button"
            className="sidepanel-toggle"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Collapse menu' : 'Expand menu'}
          >
            <Menu size={18} />
          </button>
        </div>

        <nav className="sidepanel-nav">
          <div className="sidepanel-menu">
            <Link to="/dashboard" className={`sidepanel-link ${location.pathname === '/dashboard' ? 'active' : ''}`} onClick={closeDrawer}>
              <LayoutDashboard size={18} /> <span>Dashboard</span>
            </Link>
            <Link to={user?._id ? `/profile/${user._id}` : '/profile'} className={`sidepanel-link ${location.pathname.startsWith('/profile') ? 'active' : ''}`} onClick={closeDrawer}>
              <User size={18} /> <span>Profile</span>
            </Link>
            <Link to="/create-task" className={`sidepanel-link ${location.pathname === '/create-task' ? 'active' : ''}`} onClick={closeDrawer}>
              <Plus size={18} /> <span>Create Task</span>
            </Link>
            <Link to="/groups" className={`sidepanel-link ${location.pathname === '/groups' ? 'active' : ''}`} onClick={closeDrawer}>
              <Users size={18} /> <span>Groups</span>
            </Link>
            <Link to="/friends" className={`sidepanel-link ${location.pathname === '/friends' ? 'active' : ''}`} onClick={closeDrawer}>
              <UserCheck size={18} /> <span>Friends</span>
            </Link>
            <Link to="/notifications" className={`sidepanel-link ${location.pathname === '/notifications' ? 'active' : ''}`} onClick={closeDrawer}>
              <Bell size={18} /> <span>Notifications</span>
            </Link>
            <Link to="/about" className={`sidepanel-link ${location.pathname === '/about' ? 'active' : ''}`} onClick={closeDrawer}>
              <Info size={18} /> <span>About</span>
            </Link>
            <Link to="/settings" className={`sidepanel-link ${location.pathname === '/settings' ? 'active' : ''}`} onClick={closeDrawer}>
              <Settings size={18} /> <span>Settings</span>
            </Link>
          </div>

          <div className="sidepanel-footer">
            <span className="sidepanel-user">
              <UserCircle size={20} />
              <span className="user-name">{user.name?.split(' ')[0] || 'Student'}</span>
            </span>
            <button onClick={logout} className="sidepanel-logout" title="Logout">
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </nav>
      </aside>
    </>
  );
}
