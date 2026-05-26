// src/App.jsx
import AnnouncementBanner from "./components/AnnouncementBanner";
import { useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './firebase/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoadingScreen  from './components/LoadingScreen'
import AuroraBackground from './components/AuroraBackground'
import NotificationPrompt from './components/NotificationPrompt'  // ← ADD THIS
import { app } from './firebase/config'                            // ← ADD THIS
import './styles/main.css'

// ── Lazy load all pages ──
const Login   = lazy(() => import('./pages/Login'))
const Rooms   = lazy(() => import('./pages/Rooms'))
const Room    = lazy(() => import('./pages/Room'))
const Pricing = lazy(() => import('./pages/Pricing'))
const Support = lazy(() => import('./pages/Support'))

const PageLoader = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', color: 'white', fontSize: '16px',
    fontFamily: 'monospace', background: 'transparent'
  }}>
    Loading...
  </div>
)

const hasVisitedBefore = localStorage.getItem('nxl-visited')

export default function App() {
  const [loading, setLoading] = useState(!hasVisitedBefore)

  const handleComplete = () => {
    localStorage.setItem('nxl-visited', '1')
    setLoading(false)
  }

  if (loading) {
    return <LoadingScreen onComplete={handleComplete} />
  }

  return (
    <AuthProvider>
      <AuroraBackground>
        <AnnouncementBanner type="update" />
        <NotificationPrompt firebaseApp={app} />  {/* ← ADD THIS */}
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login"   element={<Login />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/support" element={<Support />} />
              <Route path="/rooms"        element={<ProtectedRoute><Rooms /></ProtectedRoute>} />
              <Route path="/room/:roomId" element={<ProtectedRoute><Room /></ProtectedRoute>} />
              <Route path="/"  element={<Navigate to="/rooms" replace />} />
              <Route path="*"  element={<Navigate to="/rooms" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuroraBackground>
    </AuthProvider>
  )
}