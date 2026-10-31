import { BrowserRouter as Router } from 'react-router-dom';
import { ToastContainer, Slide } from 'react-toastify';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { useAuth } from './pages/authentication/AuthContext';
import AppRoutes from './app/AppRoutes';
import TermsGate from './features/legal/TermsGate';
import './App.css';

const AppContent = () => {
  const { loading } = useAuth();
  const { theme } = useTheme();

  return (
    <>
      <ToastContainer position={window.matchMedia('(max-width: 720px)').matches ? 'top-center' : 'top-right'} transition={Slide} autoClose={4000} newestOnTop theme={theme} />
      {/* Wait for the session check before routing, so a deep link isn't treated as signed out for a moment. */}
      {loading ? (
        <div className="app-boot" role="status">Loading StressCare...</div>
      ) : (
        <Router>
          <TermsGate />
          <AppRoutes />
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
