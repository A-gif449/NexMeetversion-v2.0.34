// src/App.jsx  ── UPDATED ──
// Changes: added lazy loading for all pages + Suspense fallback for performance
//          + AnnouncementBanner for updates / maintenance notices

import AnnouncementBanner from "./components/AnnouncementBanner";
import { useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './firebase/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoadingScreen  from './components/LoadingScreen'
import AuroraBackground from './components/AuroraBackground'
import './styles/main.css'

// ── Lazy load all pages (code splitting) ──
const Login   = lazy(() => import('./pages/Login'))
const Rooms   = lazy(() => import('./pages/Rooms'))
const Room    = lazy(() => import('./pages/Room'))
const Pricing = lazy(() => import('./pages/Pricing'))
const Support = lazy(() => import('./pages/Support'))

// ── Fallback shown while a page chunk is loading ──
const PageLoader = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    color: 'white',
    fontSize: '16px',
    fontFamily: 'monospace',
    background: 'transparent'
  }}>
    Loading...
  </div>
)

export default function App() {
  const [loading, setLoading] = useState(true)

  if (loading) {
    return <LoadingScreen onComplete={() => setLoading(false)} />
  }

  return (
    <AuthProvider>
      <AuroraBackground>

        {/* ── Announcement Banner (sits above everything, non-intrusive) ── */}
        <AnnouncementBanner
          type="update"                                  // "update" | "maintenance"
          // title="NexMeet v3.0 is Almost Here"         // optional: override default
          // subtitle="AI noise cancellation & more"     // optional: override default
          // scheduledFor="June 12, 2026 · 2:00 PM UTC" // optional: override default
          // autoHide={10000}                            // optional: auto-dismiss in ms
        />

        <BrowserRouter>
          {/* ── Suspense wraps Routes so lazy pages load with fallback ── */}
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/login"   element={<Login />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/support" element={<Support />} />

              {/* Protected routes */}
              <Route path="/rooms"        element={<ProtectedRoute><Rooms /></ProtectedRoute>} />
              <Route path="/room/:roomId" element={<ProtectedRoute><Room /></ProtectedRoute>} />

              {/* Default redirect */}
              <Route path="/"  element={<Navigate to="/rooms" replace />} />
              <Route path="*"  element={<Navigate to="/rooms" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>

      </AuroraBackground>
    </AuthProvider>
  )
}