import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import NotFound from './pages/NotFound';
import AuthPage from './pages/authentication/AuthPage';
import AppShell from './components/layout/AppShell';
import PageSkeleton from './components/layout/PageSkeleton';
import { RedirectWithQuery, SettingsRedirect } from './components/layout/redirects';
import { rewriteFriendsQuery, rewriteReviewersQuery, rewriteScheduleQuery } from './utils/legacyRoutes';
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
const SubjectDetail = lazy(() => import('./pages/SubjectDetail'));
const ReviewerPage = lazy(() => import('./pages/ReviewerPage'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
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

// People is Groups, or Friends with `?tab=friends`.
function PeopleRoute() {
  const { search } = useLocation();
  return new URLSearchParams(search).get('tab') === 'friends' ? <Friends /> : <Groups />;
}

// Another student's profile. Your own id goes to your own profile.
function PersonRoute() {
  const { user } = useAuth();
  const { uid } = useParams();
  if (uid === user?._id) return <Navigate to={`/profile/${uid}`} replace />;
  return <PublicProfile uid={uid} />;
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
  return <Navigate to={from ? `${from.pathname}${from.search}${from.hash}` : '/home'} replace />;
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
        signed out for a moment and bounced to Home, losing links like /plan?code=. */}
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
        <Route path="/home" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/plan" element={<RequireAuth><Schedule /></RequireAuth>} />
        <Route path="/study" element={<RequireAuth><Reviewers /></RequireAuth>} />
        <Route path="/study/reviewers/:id" element={<RequireAuth><ReviewerPage /></RequireAuth>} />
        <Route path="/study/subjects/:id" element={<RequireAuth><SubjectDetail /></RequireAuth>} />
        <Route path="/people" element={<RequireAuth><PeopleRoute /></RequireAuth>} />
        <Route path="/people/:uid" element={<RequireAuth><PersonRoute /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/profile/:uid" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/about" element={<About />} />
        <Route path="/terms-of-service" element={<LegalPage kind="terms" />} />
        <Route path="/privacy-policy" element={<LegalPage kind="privacy" />} />
        {/* Old paths. They stay forever: bookmarks, shared links, stored notification links and push clicks use them. */}
        <Route path="/dashboard" element={<RedirectWithQuery to="/home" />} />
        <Route path="/schedule" element={<RedirectWithQuery to="/plan" rewrite={rewriteScheduleQuery} />} />
        <Route path="/create-task" element={<Navigate to="/plan?task=new" replace />} />
        <Route path="/reviewers" element={<RedirectWithQuery to="/study" rewrite={rewriteReviewersQuery} />} />
        <Route path="/subjects/:id" element={<RedirectWithQuery to="/study/subjects/:id" />} />
        <Route path="/groups" element={<RedirectWithQuery to="/people" />} />
        <Route path="/friends" element={<RedirectWithQuery to="/people" rewrite={rewriteFriendsQuery} />} />
        <Route path="/settings" element={<RequireAuth><SettingsRedirect /></RequireAuth>} />
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
