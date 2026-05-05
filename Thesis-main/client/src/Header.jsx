import "./Header.css";
import { useAuth } from "./context/AuthContext";
import { LogOut } from 'lucide-react';

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="header">
      <div className="logo">
        Stress<span>Care</span>
      </div>

      <nav className="nav">
        {user ? (
          <>
            <span className="user-info text-gray-700 font-medium">
              Hi, {user.name?.split(' ')[0] || 'Student'}
            </span>
            <button 
              onClick={logout} 
              className="logout-btn flex items-center gap-1 font-medium transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </>
        ) : null}
      </nav>
    </header>
  );
}