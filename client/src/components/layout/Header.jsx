import { useAuth } from "../../pages/authentication/AuthContext";
import { LogOut, UserCircle, User, Plus, Info, Settings, Users, UserCheck, Bell, LayoutDashboard } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import Logo from '../../assets/logo.svg'; // Assuming you create this file

export default function Header() {
  const { user, logout, isLoggedin } = useAuth();
  const location = useLocation();

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
    <aside className="sidepanel">
      <div className="sidepanel-logo">
        <Link to="/" className="logo-link">
          <img src={Logo} alt="StressCare Logo" className="logo-svg" />
          <div className="logo-text">Stress<span>Care</span></div>
        </Link>
      </div>

      <nav className="sidepanel-nav">
        <div className="sidepanel-menu">
          <Link to="/dashboard" className={`sidepanel-link ${location.pathname === '/dashboard' ? 'active' : ''}`}>
            <LayoutDashboard size={18} /> <span>Dashboard</span>
          </Link>
          <Link to={user?._id ? `/profile/${user._id}` : '/profile'} className={`sidepanel-link ${location.pathname.startsWith('/profile') ? 'active' : ''}`}>
            <User size={18} /> <span>Profile</span>
          </Link>
          <Link to="/create-task" className={`sidepanel-link ${location.pathname === '/create-task' ? 'active' : ''}`}>
            <Plus size={18} /> <span>Create Task</span>
          </Link>
          <Link to="/groups" className={`sidepanel-link ${location.pathname === '/groups' ? 'active' : ''}`}>
            <Users size={18} /> <span>Groups</span>
          </Link>
          <Link to="/friends" className={`sidepanel-link ${location.pathname === '/friends' ? 'active' : ''}`}>
            <UserCheck size={18} /> <span>Friends</span>
          </Link>
          <Link to="/notifications" className={`sidepanel-link ${location.pathname === '/notifications' ? 'active' : ''}`}>
            <Bell size={18} /> <span>Notifications</span>
          </Link>
          <Link to="/about" className={`sidepanel-link ${location.pathname === '/about' ? 'active' : ''}`}>
            <Info size={18} /> <span>About</span>
          </Link>
          <Link to="/settings" className={`sidepanel-link ${location.pathname === '/settings' ? 'active' : ''}`}>
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
  );
}
