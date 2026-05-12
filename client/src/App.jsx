import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Profile from './pages/user/Profile';
import TaskCreation from './pages/TaskCreation';
import About from './pages/About';
import Settings from './pages/Settings';
import Friends from './pages/Friends';
import Groups from './pages/Groups';
import Notifications from './pages/Notifications';
import AuthPage from './pages/authentication/AuthPage';
import { ThemeProvider } from './context/ThemeContext';
import './App.css';
import { useAuth } from './pages/authentication/AuthContext';
                        
const AppContent = () => {
  const { isLoggedin } = useAuth();       

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={isLoggedin ? <Navigate to="/dashboard" replace /> : <AuthPage />} />
        <Route path="/dashboard" element={isLoggedin ? <Dashboard /> : <Navigate to="/" replace />} />
        <Route path="/profile" element={isLoggedin ? <Profile /> : <Navigate to="/" replace />} />
        <Route path="/profile/:uid" element={isLoggedin ? <Profile /> : <Navigate to="/" replace />} />
        <Route path="/create-task" element={isLoggedin ? <TaskCreation /> : <Navigate to="/" replace />} />
        <Route path="/about" element={<About />} />
        <Route path="/settings" element={isLoggedin ? <Settings /> : <Navigate to="/" replace />} />
        <Route path="/friends" element={isLoggedin ? <Friends /> : <Navigate to="/" replace />} />
        <Route path="/groups" element={isLoggedin ? <Groups /> : <Navigate to="/" replace />} />
        <Route path="/notifications" element={isLoggedin ? <Notifications /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;