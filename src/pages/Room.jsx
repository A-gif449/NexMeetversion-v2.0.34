// src/pages/Room.jsx
// FIXED:
//   1. setupDoneRef is now set to true AFTER getUserMedia succeeds (not before),
//      so a camera-denied error leaves the ref false and the effect can retry.
//   2. Local video stream is attached via a dedicated useEffect so it always
//      runs after the videoRef is mounted (fixes blank video after admit).
//   3. RemoteVideoTile already had a useEffect for stream — no change needed there.
//   4. ✅ FIXED: isPrivate is now read from Firestore — public rooms bypass the
//      waiting room entirely; only private rooms require host admission.
//
// AD SYSTEM:
//   - Free users see a 30-60 sec ad overlay when joining or rejoining.
//   - Pro users bypass ads entirely.
//
// ICONS: lucide-react (replaces @phosphor-icons/react)

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../firebase/AuthContext'
import { io } from 'socket.io-client'
import { PeerConnectionManager } from '../utils/webrtc'

// ── Lucide Icons (drop-in replacement for @phosphor-icons/react) ───────────────
import {
  Mic, MicOff,
  Video, VideoOff,
  Monitor, MonitorUp,
  MessageCircle,
  Users,
  Hand,
  Smile,
  Type,
  PhoneOff,
  Link,
  ArrowUp,
  X,
  WifiOff,
  Wifi,
} from 'lucide-react'

// ── Feature imports ────────────────────────────────────────────────────────────
import { useMeetingPersistence }               from '../utils/meetingPersistence'
import { useAdaptiveQuality, QUALITY_PRESETS } from '../utils/adaptiveQuality'
import { useConnectionHealth }                 from '../utils/peerOptimizer'
import { useE2EEncryption }                    from '../utils/e2eEncryption'
import {
  RejoinBanner,
  RoomFeaturesToolbar,
} from '../components/RoomFeatures'

// ── Waiting Room imports ───────────────────────────────────────────────────────
import useWaitingRoom from '../utils/useWaitingRoom'
import WaitingRoom    from '../components/WaitingRoom'
import AdmitPanel     from '../components/AdmitPanel'

// ── Ad overlay ────────────────────────────────────────────────────────────────
import MeetingAdOverlay from '../components/MeetingAdOverlay'

// ── Firestore imports ──────────────────────────────────────────────────────────
import { db } from '../firebase/config'
import { doc, getDoc } from 'firebase/firestore'

// ── Floating emoji reaction ────────────────────────────────────────────────────
function FloatingReaction({ emoji, name, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t) }, [])
  const left = `${20 + Math.random() * 60}%`
  return (
    <div style={{
      position: 'fixed', bottom: 100, left,
      fontSize: '2.5rem', animation: 'floatUp 2.5s ease-out forwards',
      pointerEvents: 'none', zIndex: 9999,
    }}>
      {emoji}
      <div style={{ fontSize: '0.7rem', color: '#fff', textAlign: 'center', marginTop: -8 }}>{name}</div>
    </div>
  )
}

export default function Room() {
  const { roomId } = useParams()
  const { user, plan } = useAuth()
  const navigate   = useNavigate()

  // ── Ad state ───────────────────────────────────────────────────────────────
  const [showAd, setShowAd] = useState(false)
  const adDoneRef = useRef(false)

  // ── Standard state ─────────────────────────────────────────────────────────
  const [micOn,        setMicOn]        = useState(true)
  const [camOn,        setCamOn]        = useState(true)
  const [screenOn,     setScreenOn]     = useState(false)
  const [chatOpen,     setChatOpen]     = useState(false)
  const [participOpen, setParticipOpen] = useState(false)
  const [chatMsg,      setChatMsg]      = useState('')
  const [messages,     setMessages]     = useState([])
  const [elapsed,      setElapsed]      = useState(0)
  const [peers,        setPeers]        = useState({})
  const [handRaised,   setHandRaised]   = useState(false)
  const [reactions,    setReactions]    = useState([])
  const [toast,        setToast]        = useState('')
  const [transcript,   setTranscript]   = useState([])
  const [transcribing, setTranscribing] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [isHost,       setIsHost]       = useState(null)

  // ✅ NEW: tracks whether this room is private (read from Firestore)
  // null = still loading, true = private, false = public
  const [isPrivateRoom, setIsPrivateRoom] = useState(null)

  // ✅ NEW: true when a non-host joins a PUBLIC room — skips waiting room entirely
  const [waitingBypass, setWaitingBypass] = useState(false)

  // ── Feature state ──────────────────────────────────────────────────────────
  const [activePc,      setActivePc]      = useState(null)
  const [peerHealth,    setPeerHealth]    = useState({})
  const [overallHealth, setOverallHealth] = useState('good')

  // ── Refs ───────────────────────────────────────────────────────────────────
  const videoRef       = useRef(null)
  const streamRef      = useRef(null)
  const screenRef      = useRef(null)
  const socketRef      = useRef(null)
  const pcmRef         = useRef(null)
  const recognitionRef = useRef(null)
  const chatEndRef     = useRef(null)
  const joinedAtRef    = useRef(Date.now())

  // ── Feature hooks ──────────────────────────────────────────────────────────
  const {
    session, rejoinData, confirmRejoin, clearRejoin, updateMediaState, endSession,
  } = useMeetingPersistence(roomId, user)

  const { quality, isAuto, setManualQuality, enableAuto } =
    useAdaptiveQuality(activePc, streamRef.current)

  const { health, stats } = useConnectionHealth(activePc)

  const {
    e2e, encryptionStatus, initEncryption, addPeer: addE2EPeer, exportPublicKey,
  } = useE2EEncryption()

  const {
    waitingStatus, waitingUsers, requestToJoin, admitUser, denyUser,
  } = useWaitingRoom(roomId, user, isHost)

  // ── Determine host + read isPrivate from Firestore ─────────────────────────
  useEffect(() => {
    if (!roomId || !user) return
    const checkHost = async () => {
      try {
        const roomDoc = await getDoc(doc(db, 'rooms', roomId))
        if (roomDoc.exists()) {
          const data = roomDoc.data()
          const iAmHost = data.hostUid === user.uid
          setIsHost(iAmHost)
          setIsPrivateRoom(!!data.isPrivate)

          // ✅ If room is PUBLIC and this user is a guest, bypass waiting room
          if (!iAmHost && !data.isPrivate) {
            setWaitingBypass(true)
            console.log('[NexMeet] Public room — guest bypass active')
          }
        } else {
          // No room doc — treat as public, joining user becomes host
          setIsHost(true)
          setIsPrivateRoom(false)
        }
      } catch (err) {
        console.error('[NexMeet] Failed to resolve host:', err)
        setIsHost(false)
        setIsPrivateRoom(false)
      }
    }
    checkHost()
  }, [roomId, user])

  // ── Show ad for free users ─────────────────────────────────────────────────
  useEffect(() => {
    if (isHost === null) return
    // ✅ For guests: wait for admission OR bypass (public room)
    if (isHost === false && !waitingBypass && waitingStatus !== 'admitted') return
    if (plan !== 'free') return
    if (adDoneRef.current) return
    adDoneRef.current = true
    setShowAd(true)
  }, [isHost, waitingStatus, waitingBypass, plan])

  const handleAdComplete = useCallback(() => setShowAd(false), [])

  const handleSetManualQuality = useCallback((level) => {
    setManualQuality(level)
    pcmRef.current?.setQualityForAll(level)
  }, [setManualQuality])

  const handleEnableAuto = useCallback(() => {
    enableAuto()
    pcmRef.current?.enableAutoQualityForAll()
  }, [enableAuto])

  useEffect(() => {
    const levels = Object.values(peerHealth).map(p => p.health)
    if (levels.includes('poor'))          setOverallHealth('poor')
    else if (levels.includes('degraded')) setOverallHealth('degraded')
    else                                  setOverallHealth('good')
  }, [peerHealth])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [streamRef.current])

  const setupDoneRef = useRef(false)

  useEffect(() => {
    // Reset setup lock when a private-room guest gets admitted
    if (isHost === false && !waitingBypass && waitingStatus === 'admitted') {
      setupDoneRef.current = false
      console.log('[NexMeet] Guest admitted — resetting setup lock')
    }
  }, [isHost, waitingStatus, waitingBypass])

  useEffect(() => {
    if (setupDoneRef.current) return
    if (isHost === null) return
    if (isPrivateRoom === null) return  // ✅ wait until privacy is known

    // ✅ Only gate on waitingStatus for PRIVATE rooms
    if (isHost === false && !waitingBypass && waitingStatus !== 'admitted') return

    console.log(`[NexMeet] Setup starting — isHost:${isHost} waitingStatus:${waitingStatus} isPrivate:${isPrivateRoom} bypass:${waitingBypass}`)
    joinedAtRef.current = Date.now()
    const socket = io(import.meta.env.VITE_BACKEND_URL)
    socketRef.current = socket

    let e2eInstance = null
    const initE2E = async () => {
      try { e2eInstance = await initEncryption() }
      catch (err) { console.warn('[NexMeet] E2E init failed (non-fatal):', err) }
    }

    const setup = async () => {
      await initE2E()
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      } catch (err) {
        console.error('[NexMeet] getUserMedia failed:', err.name, err.message)
        if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          console.warn('[NexMeet] Camera in use — falling back to audio-only')
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })
            setCamOn(false)
            showToast('Camera is in use by another app — joined audio only.')
          } catch (audioErr) {
            socket.disconnect()
            showToast('Camera is in use and mic access failed. Close other apps and try again.')
            return
          }
        } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          socket.disconnect()
          showToast('Camera/mic permission denied — allow access then rejoin.')
          return
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })
            setCamOn(false)
            showToast('No camera found — joined with audio only.')
          } catch (audioErr) {
            socket.disconnect()
            showToast('No camera or microphone found.')
            return
          }
        } else {
          socket.disconnect()
          showToast(`Could not access camera/mic (${err.name}). Please try again.`)
          return
        }
      }

      setupDoneRef.current = true
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream

      const pcm = new PeerConnectionManager({
        socket,
        localStream: stream,
        e2eManager: e2eInstance,
        onTrack: (socketId, remoteStream) => {
          setPeers(prev => ({ ...prev, [socketId]: { ...prev[socketId], stream: remoteStream } }))
          setActivePc(pcm.peers.get(socketId) || null)
        },
        onConnectionStateChange: (socketId, state) => {
          if (state === 'failed')    showToast('Connection lost — reconnecting…')
          if (state === 'connected') showToast('Connected')
        },
        onHealthChange: (socketId, health, stats) => {
          setPeerHealth(prev => ({ ...prev, [socketId]: { health, stats } }))
          if (health === 'poor') showToast('Poor connection detected')
        },
        onQualityChange: (socketId, level, preset, reason) => {
          if (reason === 'auto-down') showToast(`Video quality reduced to ${preset.label}`)
          if (reason === 'auto-up')   showToast(`Video quality improved to ${preset.label}`)
        },
      })
      pcmRef.current = pcm

      socket.on('room-joined', ({ existingPeers }) => {
        existingPeers.forEach(({ socketId, displayName }) => {
          setPeers(prev => ({ ...prev, [socketId]: { displayName } }))
          pcm.callPeer(socketId)
        })
      })

      socket.on('peer-joined', ({ socketId, displayName }) => {
        setPeers(prev => ({ ...prev, [socketId]: { displayName } }))
        showToast(`${displayName} joined`)
        pcm.callPeer(socketId)
      })

      socket.on('offer', ({ from, offer, displayName }) => {
        setPeers(prev => ({ ...prev, [from]: { ...prev[from], displayName } }))
        pcm.handleOffer(from, offer)
      })
      socket.on('answer',        ({ from, answer })    => pcm.handleAnswer(from, answer))
      socket.on('ice-candidate', ({ from, candidate }) => pcm.handleIceCandidate(from, candidate))

      socket.emit('join-room', { roomId, displayName: user?.displayName || 'Guest' })

      if (e2eInstance) {
        try {
          const myPublicKey = await exportPublicKey()
          socket.emit('e2e-public-key', { roomId, key: myPublicKey })
        } catch (err) {
          console.warn('[NexMeet] Could not broadcast E2E key:', err)
        }
      }

      socket.on('e2e-public-key', async ({ from, key }) => {
        if (!e2eInstance || from === socket.id) return
        try {
          await addE2EPeer(from, key)
          await pcm.addE2EPeer(from, key)
          showToast('End-to-end encryption active')
        } catch (err) {
          console.warn('[NexMeet] E2E key exchange failed:', err)
        }
      })

      socket.on('peer-left', ({ socketId }) => {
        setPeers(prev => {
          const name = prev[socketId]?.displayName || 'Someone'
          showToast(`${name} left`)
          const p = { ...prev }; delete p[socketId]; return p
        })
        setPeerHealth(prev => { const p = { ...prev }; delete p[socketId]; return p })
        pcm.removePeer(socketId)
      })

      socket.on('chat-message', ({ displayName, message, timestamp }) => {
        setMessages(m => [...m, { from: displayName, text: message, ts: timestamp }])
      })
      socket.on('peer-raise-hand', ({ socketId, raised }) => {
        setPeers(prev => ({ ...prev, [socketId]: { ...prev[socketId], handRaised: raised } }))
      })
      socket.on('peer-reaction', ({ displayName, emoji }) => {
        setReactions(r => [...r, { id: Date.now() + Math.random(), emoji, name: displayName }])
      })
      socket.on('peer-media-state', ({ socketId, video, audio }) => {
        setPeers(prev => ({ ...prev, [socketId]: { ...prev[socketId], camOn: video, micOn: audio } }))
      })
    }

    setup()
    const timer = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => {
      clearInterval(timer)
      socket.disconnect()
      pcmRef.current?.closeAll()
      streamRef.current?.getTracks().forEach(t => t.stop())
      recognitionRef.current?.stop()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, waitingStatus, waitingBypass, isPrivateRoom, roomId])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Media controls ─────────────────────────────────────────────────────────
  const toggleMic = () => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !micOn })
    socketRef.current?.emit('media-state', { video: camOn, audio: !micOn })
    updateMediaState({ audio: !micOn, video: camOn })
    setMicOn(m => !m)
  }
  const toggleCam = () => {
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !camOn })
    socketRef.current?.emit('media-state', { video: !camOn, audio: micOn })
    updateMediaState({ audio: micOn, video: !camOn })
    setCamOn(c => !c)
  }
  const toggleScreen = async () => {
    if (!screenOn) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        screenRef.current = screenStream
        const screenTrack = screenStream.getVideoTracks()[0]
        await pcmRef.current?.replaceTrack('video', screenTrack)
        if (videoRef.current) videoRef.current.srcObject = screenStream
        screenTrack.onended = () => stopScreen()
        socketRef.current?.emit('screen-share-started')
        setScreenOn(true)
        showToast('Screen sharing started')
      } catch { showToast('Screen share cancelled') }
    } else { stopScreen() }
  }
  const stopScreen = async () => {
    screenRef.current?.getTracks().forEach(t => t.stop())
    const camTrack = streamRef.current?.getVideoTracks()[0]
    if (camTrack) await pcmRef.current?.replaceTrack('video', camTrack)
    if (videoRef.current) videoRef.current.srcObject = streamRef.current
    socketRef.current?.emit('screen-share-stopped')
    setScreenOn(false)
    showToast('Screen sharing stopped')
  }
  const toggleHand = () => {
    const next = !handRaised
    setHandRaised(next)
    socketRef.current?.emit('raise-hand', { raised: next })
    showToast(next ? 'Hand raised' : 'Hand lowered')
  }

  const EMOJIS = ['👍','❤️','😂','😮','👏','🔥','🎉','💯']
  const sendReaction = (emoji) => {
    setReactions(r => [...r, { id: Date.now() + Math.random(), emoji, name: 'You' }])
    socketRef.current?.emit('reaction', { emoji })
    setShowReactionPicker(false)
  }

  const toggleTranscription = () => {
    if (!transcribing) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SpeechRecognition) { showToast('Speech recognition not supported'); return }
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = false
      recognition.lang = 'en-US'
      recognition.onresult = (e) => {
        const text = e.results[e.results.length - 1][0].transcript
        setTranscript(t => [...t, { speaker: user?.displayName || 'You', text, ts: Date.now() }])
      }
      recognition.onerror = () => setTranscribing(false)
      recognition.start()
      recognitionRef.current = recognition
      setTranscribing(true)
      showToast('Transcription started')
    } else {
      recognitionRef.current?.stop()
      setTranscribing(false)
      showToast('Transcription stopped')
    }
  }

  const downloadTranscript = () => {
    const text = transcript.map(t => `[${new Date(t.ts).toLocaleTimeString()}] ${t.speaker}: ${t.text}`).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `nexmeet-transcript-${roomId}.txt`; a.click()
  }

  const sendChat = () => {
    if (!chatMsg.trim()) return
    setMessages(m => [...m, { from: user?.displayName || 'You', text: chatMsg.trim(), ts: Date.now() }])
    socketRef.current?.emit('chat-message', { message: chatMsg.trim() })
    setChatMsg('')
  }

  const handleLeave = () => {
    endSession(Date.now() - joinedAtRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    socketRef.current?.disconnect()
    pcmRef.current?.closeAll()
    navigate('/rooms')
  }

  const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
  const peerList = Object.entries(peers)
  const allParticipants = [
    { name: user?.displayName || 'You', isLocal: true, handRaised },
    ...peerList.map(([, p]) => ({ name: p.displayName || 'Guest', isLocal: false, handRaised: p.handRaised }))
  ]

  // ✅ Only call requestToJoin for PRIVATE rooms
  useEffect(() => {
    if (isHost !== false) return
    if (waitingBypass) return  // public room — no waiting needed
    requestToJoin()
  }, [isHost, waitingBypass, requestToJoin])

  useEffect(() => {
    if (isHost !== false) return
    if (waitingBypass) return  // public room — can't be denied
    if (waitingStatus === 'denied') navigate('/rooms?denied=true')
  }, [isHost, waitingStatus, waitingBypass, navigate])

  // ── Render guards ──────────────────────────────────────────────────────────
  // Wait until both host status AND privacy flag are resolved
  if (isHost === null || isPrivateRoom === null) {
    return (
      <div style={{ height: '100vh', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(124,58,237,0.3)', borderTop: '3px solid #7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#71717a', fontSize: 14 }}>Setting up room…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ✅ Only show waiting room for PRIVATE rooms where guest hasn't been admitted
  if (isHost === false && !waitingBypass && (waitingStatus === 'idle' || waitingStatus === 'waiting')) {
    return (
      <WaitingRoom
        roomId={roomId}
        user={user}
        isHost={false}
        onAdmitted={() => {}}
        onDenied={() => navigate('/rooms')}
      />
    )
  }

  // ── Full room UI ───────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-200px) scale(1.5); opacity: 0; }
        }
        @keyframes nm-pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.8); }
        }
        .ctrl-btn { transition: all 0.18s cubic-bezier(0.4,0,0.2,1); }
        .ctrl-btn:hover { transform: translateY(-2px); }
        .ctrl-btn:active { transform: translateY(0px) scale(0.95); }
      `}</style>

      {showAd && <MeetingAdOverlay onComplete={handleAdComplete} />}

      <RejoinBanner rejoinData={rejoinData} onRejoin={confirmRejoin} onDismiss={clearRejoin} />

      {isHost && (
        <AdmitPanel waitingUsers={waitingUsers} onAdmit={admitUser} onDeny={denyUser} />
      )}

      {reactions.map(r => (
        <FloatingReaction key={r.id} emoji={r.emoji} name={r.name}
          onDone={() => setReactions(prev => prev.filter(x => x.id !== r.id))} />
      ))}

      {toast && (
        <div style={{
          position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15,15,22,0.97)', border: '0.5px solid rgba(124,58,237,0.3)',
          borderRadius: 100, padding: '8px 20px', fontSize: '0.82rem',
          color: '#e4e4e7', zIndex: 9998, backdropFilter: 'blur(16px)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>{toast}</div>
      )}

      <div style={{ height: '100vh', background: 'var(--bg-void)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Top bar ── */}
        <div style={{
          height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 1.25rem', background: 'rgba(5,5,8,0.95)',
          borderBottom: '0.5px solid rgba(255,255,255,0.06)', flexShrink: 0,
        }}>
          {/* Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', boxShadow: '0 0 10px rgba(124,58,237,0.6)', display: 'inline-block' }} />
            <span style={{ fontWeight: 700, fontSize: '0.88rem', letterSpacing: '-0.01em' }}>NexMeet</span>
            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.2)' }}>|</span>
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{roomId}</span>
            <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 100, border: '0.5px solid rgba(255,255,255,0.08)' }}>
              {allParticipants.length} participant{allParticipants.length !== 1 ? 's' : ''}
            </span>
            {plan === 'pro' ? (
              <span style={{ fontSize: '0.65rem', color: '#facc15', background: 'rgba(250,204,21,0.1)', border: '0.5px solid rgba(250,204,21,0.25)', padding: '2px 8px', borderRadius: 100 }}>
                ⭐ Pro
              </span>
            ) : (
              <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: 100 }}>
                Free
              </span>
            )}
            {/* ✅ Show 🔒 Private badge in top bar when room is private */}
            {isPrivateRoom && (
              <span style={{ fontSize: '0.65rem', color: '#a78bfa', background: 'rgba(124,58,237,0.1)', border: '0.5px solid rgba(124,58,237,0.25)', padding: '2px 8px', borderRadius: 100 }}>
                🔒 Private
              </span>
            )}
            {isHost && waitingUsers.length > 0 && (
              <span style={{ fontSize: '0.7rem', color: '#a78bfa', background: 'rgba(124,58,237,0.12)', border: '0.5px solid rgba(124,58,237,0.25)', padding: '2px 10px', borderRadius: 100, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#a78bfa', display: 'inline-block', animation: 'nm-pulse-dot 1.5s infinite' }} />
                {waitingUsers.length} waiting
              </span>
            )}
            {transcribing && (
              <span style={{ fontSize: '0.68rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f87171', display: 'inline-block', animation: 'nm-pulse-dot 1s infinite' }} />
                Live transcript
              </span>
            )}
          </div>

          {/* Center — timer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.2)', borderRadius: 100, padding: '5px 14px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'nm-pulse-dot 2s infinite' }} />
            <span style={{ fontSize: '0.78rem', color: '#f87171', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{fmt(elapsed)}</span>
          </div>

          {/* Right */}
          <button
            onClick={() => { navigator.clipboard.writeText(window.location.href).catch(()=>{}); showToast('Room link copied!') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)', borderRadius: 10, padding: '6px 14px',
              fontSize: '0.78rem', cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
          >
            <Link size={14} strokeWidth={2.5} />
            Copy Link
          </button>
        </div>

        {/* ── Main area ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Video grid */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: '#06060f' }}>
            <div style={{
              width: '100%', maxWidth: 960,
              display: 'grid',
              gridTemplateColumns: peerList.length === 0 ? '1fr' : peerList.length === 1 ? 'repeat(2,1fr)' : 'repeat(auto-fit, minmax(280px,1fr))',
              gap: '0.75rem',
            }}>
              <VideoTile
                name={user?.displayName || 'You'}
                isLocal videoRef={videoRef} stream={streamRef.current}
                camOn={camOn} micOn={micOn} handRaised={handRaised} isScreen={screenOn}
              />
              {peerList.map(([socketId, { stream, displayName, handRaised: hr, micOn: pm }]) => (
                <RemoteVideoTile
                  key={socketId} name={displayName || 'Guest'}
                  stream={stream} handRaised={hr} micOn={pm}
                  health={peerHealth[socketId]?.health}
                />
              ))}
            </div>
          </div>

          {/* Participant panel */}
          {participOpen && (
            <div style={{ width: 264, background: 'rgba(10,10,16,0.98)', borderLeft: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '1rem', borderBottom: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Participants ({allParticipants.length})</span>
                <button onClick={() => setParticipOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {allParticipants.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, flexShrink: 0 }}>
                      {p.name[0].toUpperCase()}
                    </div>
                    <span style={{ fontSize: '0.82rem', flex: 1 }}>{p.name}{p.isLocal ? ' (you)' : ''}</span>
                    {p.handRaised && <Hand size={14} color="#facc15" fill="#facc15" />}
                    {p.isLocal && isHost && (
                      <span style={{ fontSize: '0.62rem', color: '#facc15', background: 'rgba(250,204,21,0.1)', border: '0.5px solid rgba(250,204,21,0.2)', borderRadius: 100, padding: '1px 7px' }}>Host</span>
                    )}
                  </div>
                ))}
                {isHost && waitingUsers.length > 0 && (
                  <>
                    <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', padding: '8px 4px 4px', borderTop: '0.5px solid rgba(255,255,255,0.06)', marginTop: 4 }}>Waiting to join</div>
                    {waitingUsers.map((u) => (
                      <div key={u.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(124,58,237,0.06)', border: '0.5px solid rgba(124,58,237,0.15)' }}>
                        <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}&background=7c3aed&color=fff`} alt={u.displayName} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.78rem', flex: 1 }}>{u.displayName}</span>
                        <button onClick={() => admitUser(u.userId)} style={{ background: '#7c3aed', border: 'none', color: '#fff', borderRadius: 6, padding: '3px 10px', fontSize: '0.7rem', cursor: 'pointer' }}>Admit</button>
                        <button onClick={() => denyUser(u.userId)} style={{ background: 'none', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', borderRadius: 6, padding: '3px 8px', fontSize: '0.7rem', cursor: 'pointer' }}>✕</button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Transcript panel */}
          {transcript.length > 0 && (
            <div style={{ width: 280, background: 'rgba(10,10,16,0.98)', borderLeft: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '1rem', borderBottom: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Type size={15} strokeWidth={2.5} color="#a78bfa" /> Transcript
                </span>
                <button onClick={downloadTranscript} style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: '0.75rem' }}>Download</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {transcript.map((t, i) => (
                  <div key={i}>
                    <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', marginBottom: 2 }}>{t.speaker} · {new Date(t.ts).toLocaleTimeString()}</div>
                    <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: 8 }}>{t.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat panel */}
          {chatOpen && (
            <div style={{ width: 300, background: 'rgba(10,10,16,0.98)', borderLeft: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '1rem', borderBottom: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MessageCircle size={15} strokeWidth={2} color="#a78bfa" fill="#a78bfa" />
                  Chat {encryptionStatus?.enabled && <span style={{ fontSize: '0.62rem', color: '#22c55e', marginLeft: 2 }}>🔐 E2E</span>}
                </span>
                <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>
              <div style={{ flex: 1, padding: '0.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {messages.length === 0
                  ? <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: '2rem' }}>No messages yet.</p>
                  : messages.map((m, i) => (
                    <div key={i}>
                      <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>{m.from}</div>
                      <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: 10, border: '0.5px solid rgba(255,255,255,0.06)' }}>{m.text}</div>
                    </div>
                  ))
                }
                <div ref={chatEndRef} />
              </div>
              <div style={{ padding: '0.75rem', borderTop: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8 }}>
                <input
                  style={{ flex: 1, padding: '9px 13px', fontSize: '0.82rem', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', outline: 'none' }}
                  placeholder="Send a message…" value={chatMsg}
                  onChange={e => setChatMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                />
                <button
                  onClick={sendChat}
                  style={{ width: 36, height: 36, borderRadius: 10, background: '#7c3aed', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <ArrowUp size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Controls bar ── */}
        <div style={{
          height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 6, background: 'rgba(5,5,8,0.99)',
          borderTop: '0.5px solid rgba(255,255,255,0.05)', flexShrink: 0,
          padding: '0 1.5rem', position: 'relative',
        }}>

          {/* Reaction picker */}
          {showReactionPicker && (
            <div style={{
              position: 'absolute', bottom: 96, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(12,12,18,0.99)', border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: 20, padding: '12px 16px',
              display: 'flex', gap: 4, zIndex: 100,
              boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
              backdropFilter: 'blur(20px)',
            }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => sendReaction(e)} style={{
                  background: 'none', border: 'none', fontSize: '1.6rem',
                  cursor: 'pointer', borderRadius: 12, padding: '6px 8px',
                  transition: 'transform 0.15s, background 0.15s',
                }}
                  onMouseEnter={ev => { ev.currentTarget.style.transform = 'scale(1.35)'; ev.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                  onMouseLeave={ev => { ev.currentTarget.style.transform = 'scale(1)'; ev.currentTarget.style.background = 'none' }}
                >{e}</button>
              ))}
            </div>
          )}

          {/* Media controls */}
          <ControlBtn
            active={micOn} danger={!micOn}
            onClick={toggleMic}
            icon={micOn ? <Mic size={20} strokeWidth={2} /> : <MicOff size={20} strokeWidth={2} />}
            label={micOn ? 'Mute' : 'Unmuted'}
          />
          <ControlBtn
            active={camOn} danger={!camOn}
            onClick={toggleCam}
            icon={camOn ? <Video size={20} strokeWidth={2} /> : <VideoOff size={20} strokeWidth={2} />}
            label={camOn ? 'Camera' : 'No cam'}
          />
          <ControlBtn
            active={screenOn}
            onClick={toggleScreen}
            icon={screenOn ? <MonitorUp size={20} strokeWidth={2} /> : <Monitor size={20} strokeWidth={2} />}
            label={screenOn ? 'Sharing' : 'Share'}
          />

          <Divider />

          {/* Collaboration */}
          <ControlBtn
            active={chatOpen}
            onClick={() => { setChatOpen(c=>!c); setParticipOpen(false) }}
            icon={<MessageCircle size={20} strokeWidth={2} fill={chatOpen ? 'currentColor' : 'none'} />}
            label="Chat"
            badge={messages.length}
          />
          <ControlBtn
            active={participOpen}
            onClick={() => { setParticipOpen(p=>!p); setChatOpen(false) }}
            icon={<Users size={20} strokeWidth={2} />}
            label="People"
            badge={allParticipants.length}
          />
          <ControlBtn
            active={handRaised} highlight={handRaised}
            onClick={toggleHand}
            icon={<Hand size={20} strokeWidth={2} fill={handRaised ? 'currentColor' : 'none'} />}
            label={handRaised ? 'Lower' : 'Raise'}
          />
          <ControlBtn
            active={showReactionPicker}
            onClick={() => setShowReactionPicker(r=>!r)}
            icon={<Smile size={20} strokeWidth={2} fill={showReactionPicker ? 'currentColor' : 'none'} />}
            label="React"
          />
          <ControlBtn
            active={transcribing} pulse={transcribing}
            onClick={toggleTranscription}
            icon={<Type size={20} strokeWidth={2} />}
            label={transcribing ? 'Live' : 'Notes'}
          />

          <Divider />

          {/* Quality + Encryption */}
          <RoomFeaturesToolbar
            quality={quality} isAuto={isAuto}
            setManualQuality={handleSetManualQuality}
            enableAuto={handleEnableAuto}
            health={overallHealth} stats={stats}
            encryptionStatus={encryptionStatus}
          />

          <Divider />

          {/* Leave */}
          <LeaveBtn onClick={handleLeave} />
        </div>
      </div>
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RemoteVideoTile({ name, stream, handRaised, micOn, health }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream
  }, [stream])
  return <VideoTile name={name} isLocal={false} videoRef={ref} stream={stream} camOn={!!stream} micOn={micOn !== false} handRaised={handRaised} health={health} />
}

function VideoTile({ name, isLocal, videoRef, stream, camOn, micOn, handRaised, isScreen, health }) {
  useEffect(() => {
    if (isLocal && videoRef?.current && stream) videoRef.current.srcObject = stream
  }, [isLocal, stream, videoRef])

  const healthBorder =
    health === 'poor'     ? '1.5px solid #ef4444' :
    health === 'degraded' ? '1.5px solid #f59e0b' :
    handRaised            ? '1.5px solid #facc15' :
    '0.5px solid rgba(255,255,255,0.08)'

  return (
    <div style={{ aspectRatio: '16/9', borderRadius: 14, background: '#0a0a14', overflow: 'hidden', position: 'relative', border: healthBorder, transition: 'border 0.3s' }}>
      {camOn ? (
        <video ref={videoRef} autoPlay muted={isLocal} playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: (isLocal && !isScreen) ? 'scaleX(-1)' : 'none' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 700 }}>
            {name[0].toUpperCase()}
          </div>
          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>{name}</span>
        </div>
      )}
      {handRaised && (
        <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(250,204,21,0.15)', border: '0.5px solid rgba(250,204,21,0.4)', borderRadius: 100, padding: '4px 10px', fontSize: '0.72rem', color: '#facc15', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Hand size={12} fill="#facc15" /> Hand raised
        </div>
      )}
      {!isLocal && health && health !== 'good' && (
        <div style={{
          position: 'absolute', top: 10, left: 10,
          background: health === 'poor' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
          border: `0.5px solid ${health === 'poor' ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}`,
          borderRadius: 100, padding: '4px 10px', fontSize: '0.7rem',
          color: health === 'poor' ? '#ef4444' : '#f59e0b',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          {health === 'poor' ? <WifiOff size={12} strokeWidth={2.5} /> : <Wifi size={12} strokeWidth={2.5} />}
          {health === 'poor' ? 'Poor connection' : 'Unstable'}
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 10, left: 10, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.55)', borderRadius: 100, padding: '4px 10px', backdropFilter: 'blur(8px)' }}>
        {!micOn && <MicOff size={12} color="#f87171" strokeWidth={2.5} />}
        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.85)' }}>{isLocal ? `${name} (you)` : name}</span>
      </div>
    </div>
  )
}

// ── Premium ControlBtn ────────────────────────────────────────────────────────
function ControlBtn({ active, danger, highlight, pulse, onClick, icon, label, badge }) {
  const bgColor =
    danger    ? 'rgba(239,68,68,0.15)'    :
    highlight ? 'rgba(250,204,21,0.12)'   :
    active    ? 'rgba(124,58,237,0.18)'   :
    'rgba(255,255,255,0.05)'

  const borderColor =
    danger    ? 'rgba(239,68,68,0.35)'    :
    highlight ? 'rgba(250,204,21,0.35)'   :
    active    ? 'rgba(124,58,237,0.4)'    :
    'rgba(255,255,255,0.08)'

  const iconColor =
    danger    ? '#f87171'  :
    highlight ? '#facc15'  :
    active    ? '#c4b5fd'  :
    'rgba(255,255,255,0.6)'

  return (
    <button
      onClick={onClick}
      className="ctrl-btn"
      title={label}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 4, width: 56, height: 64, borderRadius: 14,
        background: bgColor, border: `0.5px solid ${borderColor}`,
        cursor: 'pointer', position: 'relative', color: iconColor,
        outline: 'none',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </span>
      <span style={{ fontSize: '0.58rem', color: iconColor, fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
        {label}
      </span>
      {pulse && (
        <span style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: '50%', background: '#f87171', animation: 'nm-pulse-dot 1s infinite' }} />
      )}
      {badge > 0 && (
        <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 17, height: 17, borderRadius: 100, background: '#7c3aed', color: '#fff', fontSize: '0.58rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}

function LeaveBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="ctrl-btn"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 4, width: 56, height: 64, borderRadius: 14,
        background: 'rgba(239,68,68,0.18)', border: '0.5px solid rgba(239,68,68,0.4)',
        cursor: 'pointer', color: '#f87171', outline: 'none',
      }}
    >
      <PhoneOff size={20} strokeWidth={2} />
      <span style={{ fontSize: '0.58rem', fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Leave</span>
    </button>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.07)', margin: '0 4px', flexShrink: 0 }} />
}