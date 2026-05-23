// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../firebase/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-void)',
      }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    )
  }

  return user ? children : <Navigate to="/login" replace />
}