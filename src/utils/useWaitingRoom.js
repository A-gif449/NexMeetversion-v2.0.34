// src/utils/useWaitingRoom.js
import { useEffect, useState, useCallback, useRef } from 'react'
import { db } from '../firebase/config'
import {
  doc, setDoc, deleteDoc, onSnapshot,
  collection, getDoc,
} from 'firebase/firestore'

export default function useWaitingRoom(roomId, currentUser, isHost) {
  const [waitingStatus, setWaitingStatus] = useState('idle')
  const [waitingUsers,  setWaitingUsers]  = useState([])

  const hasRequestedRef = useRef(false)

  // ── GUEST: Request to join ──────────────────────────────────────────────
  const requestToJoin = useCallback(async () => {
    if (!roomId || !currentUser) return
    if (isHost !== false) return
    if (hasRequestedRef.current) return
    hasRequestedRef.current = true

    console.log('[NexMeet] requestToJoin fired for', currentUser.uid)

    try {
      const queueRef  = doc(db, 'waitingRooms', roomId, 'queue',  currentUser.uid)
      const statusRef = doc(db, 'waitingRooms', roomId, 'status', currentUser.uid)

      // Check if already admitted/denied (e.g. guest refreshed mid-session)
      const existingSnap = await getDoc(statusRef)
      if (existingSnap.exists()) {
        const existing = existingSnap.data()?.value
        console.log('[NexMeet] Existing status found:', existing)
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

      // ✅ Only write 'waiting' if no existing status doc
      if (!existingSnap.exists()) {
        await setDoc(statusRef, { value: 'waiting' })
      }

      setWaitingStatus('waiting')
      console.log('[NexMeet] requestToJoin complete ✅')
    } catch (err) {
      console.error('[NexMeet] requestToJoin failed:', err)
      hasRequestedRef.current = false
    }
  }, [roomId, currentUser, isHost])

  // ── GUEST: Listen for host decision ────────────────────────────────────
  useEffect(() => {
    if (isHost !== false) return
    if (!currentUser || !roomId) return

    console.log('[NexMeet] Guest: attaching status listener for', currentUser.uid)
    const statusRef = doc(db, 'waitingRooms', roomId, 'status', currentUser.uid)

    const unsub = onSnapshot(statusRef, (snap) => {
      if (!snap.exists()) {
        console.log('[NexMeet] Status doc not yet created')
        return
      }
      const status = snap.data()?.value
      console.log('[NexMeet] Status update received:', status)

      if (status === 'admitted') {
        setWaitingStatus('admitted')
        deleteDoc(doc(db, 'waitingRooms', roomId, 'queue', currentUser.uid)).catch(() => {})
      } else if (status === 'denied') {
        setWaitingStatus('denied')
        deleteDoc(doc(db, 'waitingRooms', roomId, 'queue', currentUser.uid)).catch(() => {})
        setTimeout(() => {
          deleteDoc(doc(db, 'waitingRooms', roomId, 'status', currentUser.uid)).catch(() => {})
        }, 3000)
      } else if (status === 'waiting') {
        setWaitingStatus('waiting')
      }
    }, (err) => {
      console.error('[NexMeet] Guest status listener error:', err.code, err.message)
    })

    return () => unsub()
  }, [roomId, currentUser, isHost])

  // ── HOST: Listen to waiting queue ──────────────────────────────────────
  useEffect(() => {
    if (isHost !== true) return
    if (!roomId) return

    console.log('[NexMeet] Host: attaching queue listener for room', roomId)
    const queueRef = collection(db, 'waitingRooms', roomId, 'queue')

    const unsub = onSnapshot(queueRef, (snap) => {
      const users = snap.docs
        .map(d => ({ ...d.data(), userId: d.id }))
        .sort((a, b) => (a.requestedAt || 0) - (b.requestedAt || 0))
      console.log('[NexMeet] Queue updated:', users.length, 'waiting')
      setWaitingUsers(users)
    }, (err) => {
      console.error('[NexMeet] Host queue listener error:', err.code, err.message)
    })

    return () => unsub()
  }, [isHost, roomId])

  // ── HOST: Admit ─────────────────────────────────────────────────────────
  const admitUser = useCallback(async (userId) => {
    if (!roomId || !userId) return
    console.log('[NexMeet] admitUser:', userId)
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
    console.log('[NexMeet] denyUser:', userId)
    try {
      const statusRef = doc(db, 'waitingRooms', roomId, 'status', userId)
      await setDoc(statusRef, { value: 'denied' })
      await deleteDoc(doc(db, 'waitingRooms', roomId, 'queue', userId))
      setTimeout(() => deleteDoc(statusRef).catch(() => {}), 5000)
    } catch (err) {
      console.error('[NexMeet] denyUser failed:', err)
    }
  }, [roomId])

  // Host is always admitted
  const resolvedStatus = isHost === true ? 'admitted' : waitingStatus

  return { waitingStatus: resolvedStatus, waitingUsers, requestToJoin, admitUser, denyUser }
}