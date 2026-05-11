import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppContent from './App.jsx'
import { AppContextProvider } from './pages/authentication/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppContextProvider>
      <AppContent />
    </AppContextProvider>
  </StrictMode>,
)
