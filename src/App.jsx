// src/App.jsx
import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './firebase/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login   from './pages/Login'
import Rooms   from './pages/Rooms'
import Room    from './pages/Room'
import Pricing from './pages/Pricing'
import './styles/main.css'
import LoadingScreen from './components/LoadingScreen'

export default function App() {
  const [loading, setLoading] = useState(true)

  if (loading) {
    return <LoadingScreen onComplete={() => setLoading(false)} />
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login"   element={<Login />} />
          <Route path="/pricing" element={<Pricing />} />

          {/* Protected routes */}
          <Route path="/rooms" element={<ProtectedRoute><Rooms /></ProtectedRoute>} />
          <Route path="/room/:roomId" element={<ProtectedRoute><Room /></ProtectedRoute>} />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/rooms" replace />} />
          <Route path="*" element={<Navigate to="/rooms" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}