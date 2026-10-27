import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import About from './pages/About';
import NotFound from './pages/NotFound';
import Groups from './pages/Groups';
import Schedule from './pages/Schedule';
import Notifications from './pages/Notifications';
import Wellbeing from './pages/Wellbeing';
import Reviewers from './pages/Reviewers';
import AuthPage from './pages/authentication/AuthPage';
import LegalPage from './pages/legal/LegalPage';
import TermsGate from './components/TermsGate';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { ToastContainer, Slide } from 'react-toastify';
import './App.css';
import { useAuth } from './pages/authentication/AuthContext';

// Settings now lives in Me. Old bookmarks go to the appearance section of the own profile.
function SettingsRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?._id ? `/profile/${user._id}#appearance` : '/profile'} replace />;
}

// Signed-out visitors go to the login page, which remembers where they were headed (a shared
// schedule link, a group) and sends them there once they're in.
function RequireAuth({ children }) {
  const { isLoggedin } = useAuth();
  const location = useLocation();
  return isLoggedin ? children : <Navigate to="/" replace state={{ from: location }} />;
}

function Home() {
  const { isLoggedin } = useAuth();
  const from = useLocation().state?.from;
  if (!isLoggedin) return <AuthPage />;
  return <Navigate to={from ? `${from.pathname}${from.search}` : '/dashboard'} replace />;
}

const AppContent = () => {
  const { userData, loading } = useAuth();
  const { theme } = useTheme();

  return (
    <>
    {/* Every toast() call in the app renders here. Without it, errors like a wrong
        password or an invalid code failed silently. */}
    <ToastContainer position={window.matchMedia('(max-width: 720px)').matches ? 'top-center' : 'top-right'} transition={Slide} autoClose={4000} newestOnTop theme={theme} />
    {/* Wait for the session check before routing. Otherwise a fresh load of any page counted as
        signed out for a moment and bounced to the dashboard, losing links like /schedule?code=. */}
    {loading ? (
      <div className="app-boot" role="status">Loading StressCare...</div>
    ) : (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <NotificationProvider key={userData?._id || 'guest'}>
      <TermsGate />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/profile/:uid" element={<RequireAuth><Profile /></RequireAuth>} />
        {/* Tasks are added from the schedule now. Old links and bookmarks open the task form there. */}
        <Route path="/create-task" element={<Navigate to="/schedule?task=new" replace />} />
        <Route path="/about" element={<About />} />
        <Route path="/terms-of-service" element={<LegalPage kind="terms" />} />
        <Route path="/privacy-policy" element={<LegalPage kind="privacy" />} />
        <Route path="/settings" element={<RequireAuth><SettingsRedirect /></RequireAuth>} />
        <Route path="/friends" element={<Navigate to="/groups?tab=friends" replace />} />
        <Route path="/schedule" element={<RequireAuth><Schedule /></RequireAuth>} />
        <Route path="/reviewers" element={<RequireAuth><Reviewers /></RequireAuth>} />
        <Route path="/groups" element={<RequireAuth><Groups /></RequireAuth>} />
        <Route path="/wellbeing" element={<RequireAuth><Wellbeing /></RequireAuth>} />
        <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </NotificationProvider>
    </Router>
    )}
    </>
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
