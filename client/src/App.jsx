import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import NotFound from './pages/NotFound';
import AuthPage from './pages/authentication/AuthPage';
import AppShell from './components/layout/AppShell';
import PageSkeleton from './components/layout/PageSkeleton';
import TermsGate from './components/TermsGate';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { GuideProvider } from './context/GuideContext';
import { ToastContainer, Slide } from 'react-toastify';
import './App.css';
import { useAuth } from './pages/authentication/AuthContext';

// Every page except sign-in and the 404 loads on demand, so the first visit downloads only what it shows.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const About = lazy(() => import('./pages/About'));
const Groups = lazy(() => import('./pages/Groups'));
const Friends = lazy(() => import('./pages/Friends'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Wellbeing = lazy(() => import('./pages/Wellbeing'));
const Reviewers = lazy(() => import('./pages/Reviewers'));
const LegalPage = lazy(() => import('./pages/legal/LegalPage'));

// While a page's code loads: the real shell with a skeleton in it, so nothing jumps when the page arrives.
function RouteFallback() {
  const { isLoggedin } = useAuth();
  return (
    <AppShell variant={isLoggedin ? 'app' : 'public'}>
      <PageSkeleton />
    </AppShell>
  );
}

// Settings now lives in Me. Old bookmarks go to the appearance section of the own profile.
function SettingsRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?._id ? `/profile/${user._id}#appearance` : '/profile'} replace />;
}

// Friends used to be a tab of Groups. Old notification links and bookmarks (/groups?tab=friends) go to /friends.
function GroupsRoute() {
  const { search } = useLocation();
  if (new URLSearchParams(search).get('tab') === 'friends') return <Navigate to="/friends" replace />;
  return <Groups />;
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
      <GuideProvider>
      <TermsGate />
      <Suspense fallback={<RouteFallback />}>
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
        <Route path="/friends" element={<RequireAuth><Friends /></RequireAuth>} />
        <Route path="/schedule" element={<RequireAuth><Schedule /></RequireAuth>} />
        <Route path="/reviewers" element={<RequireAuth><Reviewers /></RequireAuth>} />
        <Route path="/groups" element={<RequireAuth><GroupsRoute /></RequireAuth>} />
        <Route path="/wellbeing" element={<RequireAuth><Wellbeing /></RequireAuth>} />
        <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      </GuideProvider>
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
