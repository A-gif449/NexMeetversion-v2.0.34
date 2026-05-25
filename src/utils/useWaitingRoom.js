// src/utils/useWaitingRoom.js
// OPTIMIZED:
// - All console.log removed (production noise + minor perf cost)
// - setTimeout handles tracked via useRef to prevent leaks on unmount
// - No logic changes — all behaviour identical

import { useEffect, useState, useCallback, useRef } from 'react'
import { db } from '../firebase/config'
import {
  doc, setDoc, deleteDoc, onSnapshot,
  collection, getDoc,
} from 'firebase/firestore'

export default function useWaitingRoom(roomId, currentUser, isHost) {
  const [waitingStatus, setWaitingStatus] = useState('idle')
  const [waitingUsers,  setWaitingUsers]  = useState([])

  const hasRequestedRef  = useRef(false)
  // Track all pending setTimeout IDs so we can clear them on unmount
  const timeoutRefs      = useRef([])

  // Helper: schedule a clearable timeout
  const safeTimeout = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms)
    timeoutRefs.current.push(id)
    return id
  }, [])

  // Clear all pending timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(clearTimeout)
      timeoutRefs.current = []
    }
  }, [])

  // ── GUEST: Request to join ──────────────────────────────────────────────
  const requestToJoin = useCallback(async () => {
    if (!roomId || !currentUser) return
    if (isHost !== false) return
    if (hasRequestedRef.current) return
    hasRequestedRef.current = true

    try {
      const queueRef  = doc(db, 'waitingRooms', roomId, 'queue',  currentUser.uid)
      const statusRef = doc(db, 'waitingRooms', roomId, 'status', currentUser.uid)

      // Check if already admitted/denied (e.g. guest refreshed mid-session)
      const existingSnap = await getDoc(statusRef)
      if (existingSnap.exists()) {
        const existing = existingSnap.data()?.value
        if (existing === 'admitted') { setWaitingStatus('admitted'); return }
        if (existing === 'denied')   { setWaitingStatus('denied');   return }
      }

      // Write queue entry
      await setDoc(queueRef, {
        userId:      currentUser.uid,
        displayName: currentUser.displayName || 'Guest',
        photoURL:    currentUser.photoURL    || null,
        requestedAt: Date.now(),
      }, { merge: true })

      // Only write 'waiting' if no existing status doc
      if (!existingSnap.exists()) {
        await setDoc(statusRef, { value: 'waiting' })
      }

      setWaitingStatus('waiting')
    } catch (err) {
      console.error('[NexMeet] requestToJoin failed:', err)
      hasRequestedRef.current = false
    }
  }, [roomId, currentUser, isHost])

  // ── GUEST: Listen for host decision ────────────────────────────────────
  useEffect(() => {
    if (isHost !== false) return
    if (!currentUser || !roomId) return

    const statusRef = doc(db, 'waitingRooms', roomId, 'status', currentUser.uid)

    const unsub = onSnapshot(statusRef, (snap) => {
      if (!snap.exists()) return

      const status = snap.data()?.value

      if (status === 'admitted') {
        setWaitingStatus('admitted')
        deleteDoc(doc(db, 'waitingRooms', roomId, 'queue', currentUser.uid)).catch(() => {})
      } else if (status === 'denied') {
        setWaitingStatus('denied')
        deleteDoc(doc(db, 'waitingRooms', roomId, 'queue', currentUser.uid)).catch(() => {})
        safeTimeout(() => {
          deleteDoc(doc(db, 'waitingRooms', roomId, 'status', currentUser.uid)).catch(() => {})
        }, 3000)
      } else if (status === 'waiting') {
        setWaitingStatus('waiting')
      }
    }, (err) => {
      console.error('[NexMeet] Guest status listener error:', err.code, err.message)
    })

    return () => unsub()
  }, [roomId, currentUser, isHost, safeTimeout])

  // ── HOST: Listen to waiting queue ──────────────────────────────────────
  useEffect(() => {
    if (isHost !== true) return
    if (!roomId) return

    const queueRef = collection(db, 'waitingRooms', roomId, 'queue')

    const unsub = onSnapshot(queueRef, (snap) => {
      const users = snap.docs
        .map(d => ({ ...d.data(), userId: d.id }))
        .sort((a, b) => (a.requestedAt || 0) - (b.requestedAt || 0))
      setWaitingUsers(users)
    }, (err) => {
      console.error('[NexMeet] Host queue listener error:', err.code, err.message)
    })

    return () => unsub()
  }, [isHost, roomId])

  // ── HOST: Admit ─────────────────────────────────────────────────────────
  const admitUser = useCallback(async (userId) => {
    if (!roomId || !userId) return
    try {
      // Write status FIRST so guest listener fires before queue disappears
      await setDoc(doc(db, 'waitingRooms', roomId, 'status', userId), { value: 'admitted' })
      await deleteDoc(doc(db, 'waitingRooms', roomId, 'queue', userId))
    } catch (err) {
      console.error('[NexMeet] admitUser failed:', err)
    }
  }, [roomId])

  // ── HOST: Deny ──────────────────────────────────────────────────────────
  const denyUser = useCallback(async (userId) => {
    if (!roomId || !userId) return
    try {
      const statusRef = doc(db, 'waitingRooms', roomId, 'status', userId)
      await setDoc(statusRef, { value: 'denied' })
      await deleteDoc(doc(db, 'waitingRooms', roomId, 'queue', userId))
      safeTimeout(() => deleteDoc(statusRef).catch(() => {}), 5000)
    } catch (err) {
      console.error('[NexMeet] denyUser failed:', err)
    }
  }, [roomId, safeTimeout])

  // Host is always admitted
  const resolvedStatus = isHost === true ? 'admitted' : waitingStatus

  return { waitingStatus: resolvedStatus, waitingUsers, requestToJoin, admitUser, denyUser }
}