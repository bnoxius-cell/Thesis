import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppContent from './App.jsx'
import { AppContextProvider } from './pages/authentication/AuthContext.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE";

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AppContextProvider>
        <AppContent />
      </AppContextProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>,
)
