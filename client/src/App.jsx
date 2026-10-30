import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AuthPage from './pages/authentication/AuthPage';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ToastContainer, Slide } from 'react-toastify';
import './App.css';
import { useAuth } from './pages/authentication/AuthContext';

// Development-only specimen of the shared primitives. F3 moves this route into AppRoutes.
const UiSpecimen = import.meta.env.DEV ? lazy(() => import('./app/dev/UiSpecimen')) : null;

// Every page except sign-in was removed for the redesign. Signed-in students land here until the new pages are built.
function SignedIn() {
  const { user, logout } = useAuth();
  return (
    <main id="main" className="app-boot">
      <p>Signed in as {user?.name}. The new pages are coming.</p>
      <button type="button" onClick={() => logout()}>Log out</button>
    </main>
  );
}

const AppContent = () => {
  const { isLoggedin, loading } = useAuth();
  const { theme } = useTheme();

  return (
    <>
      <ToastContainer position={window.matchMedia('(max-width: 720px)').matches ? 'top-center' : 'top-right'} transition={Slide} autoClose={4000} newestOnTop theme={theme} />
      {loading ? (
        <div className="app-boot" role="status">Loading StressCare...</div>
      ) : (
        <Router>
          <Routes>
            {UiSpecimen && (
              <Route path="/dev/ui" element={<Suspense fallback={null}><UiSpecimen /></Suspense>} />
            )}
            <Route path="*" element={isLoggedin ? <SignedIn /> : <AuthPage />} />
          </Routes>
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
