// src/firebase/config.js
import { initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  onAuthStateChanged,
  signInAnonymously,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyB-PE80cpAsdDUcSDRx4hk7ZxXppUKz1c4",
  authDomain: "nexmeet-8c0fc.firebaseapp.com",
  projectId: "nexmeet-8c0fc",
  storageBucket: "nexmeet-8c0fc.firebasestorage.app",
  messagingSenderId: "553491407340",
  appId: "1:553491407340:web:cacc569eaa3f658f5d60c9"
}

export const app  = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db   = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()

// ── Auth helpers ──────────────────────────────
export const signInGoogle = () => signInWithPopup(auth, googleProvider)

export const signInEmail  = (email, password) =>
  signInWithEmailAndPassword(auth, email, password)

export const signUpEmail  = async (email, password, displayName) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(cred.user, { displayName })
  return cred
}

export const resetPassword = (email) => sendPasswordResetEmail(auth, email)

export const logOut = () => signOut(auth)

export const onAuth = (cb) => onAuthStateChanged(auth, cb)

export const signInGuest = () => signInAnonymously(auth)