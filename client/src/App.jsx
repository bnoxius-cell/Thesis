import { BrowserRouter as Router } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { ThemeProvider } from './context/ThemeContext';
import { ToastIcon, toastTransition, useToastFocusPause } from './shared/ui';
import { useAuth } from './pages/authentication/AuthContext';
import AppRoutes from './app/AppRoutes';
import TermsGate from './features/legal/TermsGate';
import './App.css';

const AppContent = () => {
  const { loading } = useAuth();
  useToastFocusPause();

  return (
    <>
      {/* One look for every toast (components.css). Alt+T then Esc dismisses from the keyboard. */}
      <ToastContainer
        position="bottom-center"
        autoClose={6000}
        hideProgressBar
        closeButton={false}
        pauseOnHover
        pauseOnFocusLoss
        role="status"
        limit={3}
        newestOnTop={false}
        icon={ToastIcon}
        transition={toastTransition}
      />
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
