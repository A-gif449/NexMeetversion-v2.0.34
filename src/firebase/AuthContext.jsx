// src/firebase/AuthContext.jsx
// Provides global auth state via React Context.
// Exposes: currentUser, loading, and all auth action helpers.

import { createContext, useContext, useEffect, useState } from 'react'
import {
  signInGoogle,
  signInEmail,
  signUpEmail,
  resetPassword,
  logOut,
  onAuth,
  signInGuest,
} from './config'

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext(null)

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading]         = useState(true)

  // Listen for Firebase auth state changes (login, logout, token refresh)
  useEffect(() => {
    const unsubscribe = onAuth((user) => {
      setCurrentUser(user)
      setLoading(false)
    })
    return unsubscribe   // clean up listener on unmount
  }, [])

  const value = {
    // ── State ──────────────────────────────
    currentUser,
    user: currentUser,   // alias — Login.jsx, Room.jsx and all other files use { user }
    loading,

    // ── Actions ────────────────────────────
    signInGoogle,                          // Google OAuth popup
    signInEmail,                           // email + password sign-in
    signUpEmail,                           // email + password register (sets displayName)
    resetPassword,                         // send password-reset email
    logOut,                                // sign out
    signInGuest,                           // anonymous guest sign-in
  }

  // Don't render children until Firebase has resolved the initial auth state.
  // This prevents a flash of the login page for already-logged-in users.
  if (loading) return null

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}