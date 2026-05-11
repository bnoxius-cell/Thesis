import "./Header.css";
import { useAuth } from "../../pages/authentication/AuthContext";
import { LogOut, UserCircle, User, Plus, Info, Settings, Users, UserCheck, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Header() {
  const { user, logout, isLoggedin } = useAuth();

  return (
    <header className="header">
      <div className="logo">
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          Stress<span>Care</span>
        </Link>
      </div>

      <nav className="nav">
        {isLoggedin && user ? (
          <>
            <div className="menu">
              <Link to="/profile" className="menu-item">
                <User size={16} />
                Profile
              </Link>
              <Link to="/create-task" className="menu-item">
                <Plus size={16} />
                Create Task
              </Link>
              <Link to="/about" className="menu-item">
                <Info size={16} />
                About
              </Link>
              <Link to="/settings" className="menu-item">
                <Settings size={16} />
                Settings
              </Link>
              <Link to="/groups" className="menu-item">
                <Users size={16} />
                Groups
              </Link>
              <Link to="/friends" className="menu-item">
                <UserCheck size={16} />
                Friends
              </Link>
              <Link to="/notifications" className="menu-item">
                <Bell size={16} />
                Notifications
              </Link>
            </div>
            <span className="user-info">
              <UserCircle size={18} />
              Hi, {user.name?.split(' ')[0] || 'Student'}
            </span>
            <button 
              onClick={logout} 
              className="logout-btn"
              title="Logout"
            >
              <LogOut size={17} />
              Logout
            </button>
          </>
        ) : null}
      </nav>
    </header>
  );
}
