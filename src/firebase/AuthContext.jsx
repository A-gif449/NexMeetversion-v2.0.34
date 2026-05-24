// src/firebase/AuthContext.jsx
// Extended: reads user plan ('free' | 'pro') from Firestore users/{uid}
// Falls back to 'free' if no document exists yet.

import { createContext, useContext, useEffect, useState } from 'react'
import { onAuth, logOut, db } from './config'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(undefined)   // undefined = loading
  const [plan,    setPlan]    = useState('free')       // 'free' | 'pro'
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuth(async (u) => {
      setUser(u)

      if (u) {
        try {
          const ref  = doc(db, 'users', u.uid)
          const snap = await getDoc(ref)

          if (snap.exists()) {
            // User doc already exists — read plan
            setPlan(snap.data().plan || 'free')
          } else {
            // First sign-in — create user doc with free plan
            await setDoc(ref, {
              uid:         u.uid,
              email:       u.email,
              displayName: u.displayName,
              photoURL:    u.photoURL,
              plan:        'free',
              createdAt:   serverTimestamp(),
            })
            setPlan('free')
          }
        } catch (err) {
          console.error('[NexMeet] Could not load user plan:', err)
          setPlan('free')   // safe default on error
        }
      } else {
        setPlan('free')
      }

      setLoading(false)
    })
    return unsub
  }, [])

  return (
    <AuthContext.Provider value={{ user, plan, loading, logOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)