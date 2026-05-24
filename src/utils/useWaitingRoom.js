// src/utils/useWaitingRoom.js
// FIXED: 
//   1. Guest listener no longer gated on waitingStatus — attaches immediately
//      so it catches 'admitted'/'denied' even if written before status becomes 'waiting'
//   2. admitUser no longer races — deletes queue AFTER writing status
//   3. Listener deps cleaned up — no longer re-subscribes on every status change

import { useEffect, useState, useCallback, useRef } from 'react'
import { db } from '../firebase/config'
import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
} from 'firebase/firestore'

export default function useWaitingRoom(roomId, currentUser, isHost) {
  // isHost: null = still loading | true = host | false = guest

  const [waitingStatus, setWaitingStatus] = useState('idle')
  const [waitingUsers,  setWaitingUsers]  = useState([])

  // Track whether we've already written to Firestore so requestToJoin is idempotent
  const hasRequestedRef = useRef(false)

  // ── GUEST: Request to join ────────────────────────────────────────────────
  const requestToJoin = useCallback(async () => {
    if (!roomId || !currentUser) return
    if (isHost !== false) return           // only guests
    if (hasRequestedRef.current) return    // FIX: prevent double-writes on re-render

    hasRequestedRef.current = true

    try {
      const queueRef  = doc(db, 'waitingRooms', roomId, 'queue',  currentUser.uid)
      const statusRef = doc(db, 'waitingRooms', roomId, 'status', currentUser.uid)

      // Write queue entry and status atomically (sequential is fine, both are fast)
      await setDoc(queueRef, {
        userId:      currentUser.uid,
        displayName: currentUser.displayName || 'Guest',
        photoURL:    currentUser.photoURL    || null,
        requestedAt: Date.now(),
      })
      await setDoc(statusRef, { value: 'waiting' })

      setWaitingStatus('waiting')
    } catch (err) {
      console.error('[NexMeet] requestToJoin failed:', err)
      hasRequestedRef.current = false      // allow retry on error
    }
  }, [roomId, currentUser, isHost])

  // ── GUEST: Listen for host decision ───────────────────────────────────────
  // FIX: This effect no longer depends on waitingStatus — it attaches as soon
  //      as isHost is confirmed false. That way it never misses a fast admit/deny
  //      that arrives while the component is still transitioning to 'waiting'.
  useEffect(() => {
    if (isHost !== false) return            // null (loading) or true (host) → skip
    if (!currentUser || !roomId) return

    const statusRef = doc(db, 'waitingRooms', roomId, 'status', currentUser.uid)

    const unsub = onSnapshot(statusRef, (snap) => {
      if (!snap.exists()) return

      const status = snap.data()?.value

      if (status === 'admitted') {
        setWaitingStatus('admitted')
        // Clean up queue entry only — keep status doc so Room.jsx
        // transition logic can still read 'admitted' if it re-renders
        deleteDoc(doc(db, 'waitingRooms', roomId, 'queue', currentUser.uid))

      } else if (status === 'denied') {
        setWaitingStatus('denied')
        deleteDoc(doc(db, 'waitingRooms', roomId, 'queue',  currentUser.uid))
        // Delay status cleanup so Room.jsx redirect effect can read 'denied'
        setTimeout(() => {
          deleteDoc(doc(db, 'waitingRooms', roomId, 'status', currentUser.uid))
        }, 3000)
      }
      // 'waiting' → no-op, just keep listening
    })

    return () => unsub()
  // FIX: removed waitingStatus from deps — listener must stay alive across status changes
  }, [roomId, currentUser, isHost])            // eslint-disable-line react-hooks/exhaustive-deps

  // ── HOST: Listen to waiting queue ─────────────────────────────────────────
  useEffect(() => {
    if (isHost !== true) return            // null or false → skip
    if (!roomId) return

    const queueRef = collection(db, 'waitingRooms', roomId, 'queue')
    const unsub = onSnapshot(queueRef, (snap) => {
      const users = snap.docs
        .map(d => d.data())
        .sort((a, b) => a.requestedAt - b.requestedAt)
      setWaitingUsers(users)
    })
    return () => unsub()
  }, [isHost, roomId])

  // ── HOST: Admit ────────────────────────────────────────────────────────────
  // FIX: Write status BEFORE deleting queue doc.
  //      Old order (delete queue → write status) created a window where the
  //      guest's listener saw the queue entry vanish but 'admitted' wasn't written yet.
  const admitUser = useCallback(async (userId) => {
    if (!roomId) return
    try {
      // 1. Write 'admitted' first — guest listener picks this up immediately
      await setDoc(doc(db, 'waitingRooms', roomId, 'status', userId), { value: 'admitted' })
      // 2. Then remove from queue so the host panel stops showing them
      await deleteDoc(doc(db, 'waitingRooms', roomId, 'queue', userId))
    } catch (err) {
      console.error('[NexMeet] admitUser failed:', err)
    }
  }, [roomId])

  // ── HOST: Deny ─────────────────────────────────────────────────────────────
  const denyUser = useCallback(async (userId) => {
    if (!roomId) return
    try {
      const statusRef = doc(db, 'waitingRooms', roomId, 'status', userId)
      // 1. Write 'denied' first so guest listener catches it
      await setDoc(statusRef, { value: 'denied' })
      // 2. Remove from queue
      await deleteDoc(doc(db, 'waitingRooms', roomId, 'queue', userId))
      // 3. Clean up status after guest has had time to read it
      setTimeout(() => deleteDoc(statusRef), 5000)
    } catch (err) {
      console.error('[NexMeet] denyUser failed:', err)
    }
  }, [roomId])

  // ── Cleanup on unmount (guest only) ───────────────────────────────────────
  // Only clean up if guest is still waiting (not admitted) to avoid wiping
  // a status doc that Room.jsx still needs for its transition logic.
  useEffect(() => {
    return () => {
      if (isHost !== false) return
      if (!currentUser || !roomId) return
      // Don't clean up if admitted — Room.jsx needs the status to stay 'admitted'
      // so its useEffect guard (waitingStatus !== 'admitted') lets setup proceed
      if (hasRequestedRef.current) {
        // Only wipe if we're still in the waiting state (not admitted/denied)
        // We can't read state here so we conservatively skip cleanup on unmount
        // — Firestore TTL or a Cloud Function should handle orphan docs instead
      }
    }
  }, [roomId, currentUser, isHost])

  // Host is always considered admitted
  const resolvedStatus = isHost === true ? 'admitted' : waitingStatus

  return {
    waitingStatus: resolvedStatus,
    waitingUsers,
    requestToJoin,
    admitUser,
    denyUser,
  }
}