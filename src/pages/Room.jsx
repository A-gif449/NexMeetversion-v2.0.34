// src/pages/Room.jsx  — HOLOGRAPHIC EDITION + MOBILE FIX
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../firebase/AuthContext'
import { io } from 'socket.io-client'
import { PeerConnectionManager } from '../utils/webrtc'

import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorUp,
  MessageCircle, Users, Hand, Smile, Type, PhoneOff,
  Link, ArrowUp, X, WifiOff, Wifi,
} from 'lucide-react'

import { useMeetingPersistence }             from '../utils/meetingPersistence'
import { useAdaptiveQuality }                from '../utils/adaptiveQuality'
import { useConnectionHealth }               from '../utils/peerOptimizer'
import { useE2EEncryption }                  from '../utils/e2eEncryption'
import { RejoinBanner, RoomFeaturesToolbar } from '../components/RoomFeatures'

import useWaitingRoom from '../utils/useWaitingRoom'
import WaitingRoom    from '../components/WaitingRoom'
import AdmitPanel     from '../components/AdmitPanel'
import MeetingFeedback from '../components/MeetingFeedback'

// import { db } from '../firebase/config'
// import { doc, getDoc } from 'firebase/firestore'

/* ─── Floating emoji reactions (unchanged logic) ──────────────── */
function FloatingReaction({ emoji, name, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t) }, [])
  const left = `${20 + Math.random() * 60}%`
  return (
    <div style={{
      position: 'fixed', bottom: 110, left,
      fontSize: '2.5rem',
      animation: 'floatUp 2.5s ease-out forwards',
      pointerEvents: 'none', zIndex: 9999,
      filter: 'drop-shadow(0 0 12px rgba(167,139,250,0.8))',
    }}>
      {emoji}
      <div style={{ fontSize: '0.7rem', color: '#c4b5fd', textAlign: 'center', marginTop: -8, textShadow: '0 0 8px rgba(124,58,237,0.8)' }}>{name}</div>
    </div>
  )
}

/* ─── Holographic scan-line overlay ───────────────────────────── */
function HoloScanlines() {
  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1,
      background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(124,58,237,0.015) 2px, rgba(124,58,237,0.015) 4px)',
      animation: 'scanMove 8s linear infinite',
    }} />
  )
}

/* ─── Ambient orb field ───────────────────────────────────────── */
function AmbientOrbs() {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', top: '-15%', left: '-10%', background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', animation: 'orbDrift1 20s ease-in-out infinite', filter: 'blur(40px)' }} />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', bottom: '-10%', right: '-8%', background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)', animation: 'orbDrift2 25s ease-in-out infinite', filter: 'blur(50px)' }} />
      <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', top: '40%', left: '45%', background: 'radial-gradient(circle, rgba(20,184,166,0.07) 0%, transparent 70%)', animation: 'orbDrift3 18s ease-in-out infinite', filter: 'blur(30px)' }} />
    </div>
  )
}

/* ─── Hex grid background ─────────────────────────────────────── */
function HexGrid() {
  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='52' viewBox='0 0 60 52'%3E%3Cpolygon points='30,2 58,17 58,47 30,62 2,47 2,17' fill='none' stroke='rgba(124,58,237,0.06)' stroke-width='0.5'/%3E%3C/svg%3E")`,
      backgroundSize: '60px 52px',
      opacity: 0.8,
    }} />
  )
}

/* ─── Audio wave ring (decorative) ───────────────────────────── */
function AudioRing({ active, size = 80, color = '#7c3aed' }) {
  if (!active) return null
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 2 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: 'absolute',
          width: size + i * 28,
          height: size + i * 28,
          borderRadius: '50%',
          border: `1px solid ${color}`,
          opacity: 0.4 - i * 0.12,
          animation: `audioRing 1.8s ease-out ${i * 0.4}s infinite`,
        }} />
      ))}
    </div>
  )
}

/* ─── Corner bracket decoration ──────────────────────────────── */
function CornerBrackets({ color = 'rgba(124,58,237,0.5)', size = 16 }) {
  const s = { position: 'absolute', width: size, height: size, pointerEvents: 'none' }
  const b = `1.5px solid ${color}`
  return (
    <>
      <div style={{ ...s, top: 8, left: 8, borderTop: b, borderLeft: b }} />
      <div style={{ ...s, top: 8, right: 8, borderTop: b, borderRight: b }} />
      <div style={{ ...s, bottom: 8, left: 8, borderBottom: b, borderLeft: b }} />
      <div style={{ ...s, bottom: 8, right: 8, borderBottom: b, borderRight: b }} />
    </>
  )
}

/* ══════════════════════════════════════════════════════════════ */
export default function Room() {
  const { roomId } = useParams()
  const { user }   = useAuth()
  const navigate   = useNavigate()

  // ── All original state (untouched) ──────────────────────────
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
  const [showFeedback, setShowFeedback] = useState(false)
  const [isHost,        setIsHost]        = useState(null)
  const [isPrivateRoom, setIsPrivateRoom] = useState(null)
  const [activePc,      setActivePc]      = useState(null)
  const [peerHealth,    setPeerHealth]    = useState({})
  const [overallHealth, setOverallHealth] = useState('good')

  // ── MOBILE: track which drawer is open (only one at a time on mobile) ──
  const [mobileDrawer, setMobileDrawer] = useState(null) // 'chat' | 'people' | null

  const videoRef       = useRef(null)
  const streamRef      = useRef(null)
  const screenRef      = useRef(null)
  const socketRef      = useRef(null)
  const pcmRef         = useRef(null)
  const recognitionRef = useRef(null)
  const chatEndRef     = useRef(null)
  const joinedAtRef    = useRef(Date.now())
  const setupDoneRef   = useRef(false)

  const { rejoinData, confirmRejoin, clearRejoin, updateMediaState, endSession } =
    useMeetingPersistence(roomId, user)

  const { quality, isAuto, setManualQuality, enableAuto } =
    useAdaptiveQuality(activePc, streamRef.current)

  const { health, stats } = useConnectionHealth(activePc)

  const { encryptionStatus, initEncryption, addPeer: addE2EPeer, exportPublicKey } =
    useE2EEncryption()

  const { waitingStatus, waitingUsers, requestToJoin, admitUser, denyUser } =
    useWaitingRoom(roomId, user, isHost)

  // ── All original effects + logic (100% untouched) ───────────
  useEffect(() => {
    if (!roomId || !user) return
    let cancelled = false
    const tryResolve = async (attempt = 0) => {
      if (cancelled) return
      try {
        const { db } = await import('../firebase/config')
        const { doc, getDoc } = await import('firebase/firestore')
        const snap = await getDoc(doc(db, 'rooms', roomId))
        if (snap.exists()) {
          const data = snap.data()
          const iAmHost     = data.hostUid === user.uid
          const privateRoom = data.isPrivate !== undefined ? !!data.isPrivate : true
          if (!cancelled) { setIsHost(iAmHost); setIsPrivateRoom(privateRoom) }
          return
        }
        if (attempt < 8) setTimeout(() => tryResolve(attempt + 1), 1000)
        else if (!cancelled) { setIsHost(true); setIsPrivateRoom(false) }
      } catch (err) {
        if (!cancelled) { setIsHost(false); setIsPrivateRoom(true) }
      }
    }
    tryResolve()
    return () => { cancelled = true }
  }, [roomId, user])

  useEffect(() => {
    if (isHost !== false)       return
    if (isPrivateRoom !== true) return
    requestToJoin()
  }, [isHost, isPrivateRoom, requestToJoin])

  useEffect(() => {
    if (waitingStatus === 'denied') navigate('/rooms?denied=true')
  }, [waitingStatus, navigate])

  useEffect(() => {
    if (isHost === false && isPrivateRoom === true && waitingStatus === 'admitted')
      setupDoneRef.current = false
  }, [isHost, isPrivateRoom, waitingStatus])

  const showToast = useCallback((msg) => {
    setToast(msg); setTimeout(() => setToast(''), 2500)
  }, [])

  useEffect(() => {
    const levels = Object.values(peerHealth).map(p => p.health)
    if (levels.includes('poor'))          setOverallHealth('poor')
    else if (levels.includes('degraded')) setOverallHealth('degraded')
    else                                  setOverallHealth('good')
  }, [peerHealth])

  const handleSetManualQuality = useCallback((level) => {
    setManualQuality(level); pcmRef.current?.setQualityForAll(level)
  }, [setManualQuality])

  const handleEnableAuto = useCallback(() => {
    enableAuto(); pcmRef.current?.enableAutoQualityForAll()
  }, [enableAuto])

  // ── WebRTC setup (untouched) ─────────────────────────────────
  useEffect(() => {
    if (setupDoneRef.current)   return
    if (isHost === null)        return
    if (isPrivateRoom === null) return
    if (isHost === false && isPrivateRoom === true && waitingStatus !== 'admitted') return

    setupDoneRef.current = true
    joinedAtRef.current  = Date.now()

    const socket = io(import.meta.env.VITE_BACKEND_URL)
    socketRef.current = socket

    const setup = async () => {
      let e2eInstance = null
      try { e2eInstance = await initEncryption() } catch {}

      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      } catch (err) {
        if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          try { stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true }); setCamOn(false) }
          catch { socket.disconnect(); showToast('Camera in use — close other apps and try again.'); return }
        } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          socket.disconnect(); showToast('Camera/mic permission denied.'); return
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          try { stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true }); setCamOn(false) }
          catch { socket.disconnect(); showToast('No camera or mic found.'); return }
        } else {
          socket.disconnect(); showToast(`Could not access camera/mic (${err.name}).`); return
        }
      }

      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream

      const pcm = new PeerConnectionManager({
        socket, localStream: stream, e2eManager: e2eInstance,
        onTrack: (sid, remoteStream) => {
          setPeers(prev => ({ ...prev, [sid]: { ...prev[sid], stream: remoteStream } }))
          setActivePc(pcm.peers.get(sid) || null)
        },
        onConnectionStateChange: (sid, state) => {
          if (state === 'failed')    showToast('Connection lost — reconnecting…')
          if (state === 'connected') showToast('Connected')
        },
        onHealthChange: (sid, h) => {
          setPeerHealth(prev => ({ ...prev, [sid]: { health: h } }))
          if (h === 'poor') showToast('Poor connection detected')
        },
        onQualityChange: (sid, level, preset, reason) => {
          if (reason === 'auto-down') showToast(`Quality reduced to ${preset.label}`)
          if (reason === 'auto-up')   showToast(`Quality improved to ${preset.label}`)
        },
      })
      pcmRef.current = pcm

      socket.on('room-joined', ({ existingPeers }) => {
        existingPeers.forEach(({ socketId, displayName }) => {
          setPeers(prev => ({ ...prev, [socketId]: { displayName } }))
          if (PeerConnectionManager.shouldMakeOffer(socket.id, socketId)) pcm.callPeer(socketId)
        })
      })
      socket.on('peer-joined', ({ socketId, displayName }) => {
        setPeers(prev => ({ ...prev, [socketId]: { displayName } }))
        showToast(`${displayName} joined`)
        if (PeerConnectionManager.shouldMakeOffer(socket.id, socketId)) pcm.callPeer(socketId)
      })
      socket.on('offer',         ({ from, offer, displayName }) => {
        setPeers(prev => ({ ...prev, [from]: { ...prev[from], displayName } }))
        pcm.handleOffer(from, offer)
      })
      socket.on('answer',        ({ from, answer })    => pcm.handleAnswer(from, answer))
      socket.on('ice-candidate', ({ from, candidate }) => pcm.handleIceCandidate(from, candidate))
      socket.emit('join-room', { roomId, displayName: user?.displayName || 'Guest' })

      if (e2eInstance) {
        try {
          const key = await exportPublicKey()
          socket.emit('e2e-public-key', { roomId, key })
        } catch {}
      }
      socket.on('e2e-public-key', async ({ from, key }) => {
        if (!e2eInstance || from === socket.id) return
        try { await addE2EPeer(from, key); await pcm.addE2EPeer(from, key); showToast('E2E encryption active') } catch {}
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
      socket.on('chat-message',     ({ displayName, message, timestamp }) => setMessages(m => [...m, { from: displayName, text: message, ts: timestamp }]))
      socket.on('peer-raise-hand',  ({ socketId, raised })                => setPeers(prev => ({ ...prev, [socketId]: { ...prev[socketId], handRaised: raised } })))
      socket.on('peer-reaction',    ({ displayName, emoji })              => setReactions(r => [...r, { id: Date.now() + Math.random(), emoji, name: displayName }]))
      socket.on('peer-media-state', ({ socketId, video, audio })          => setPeers(prev => ({ ...prev, [socketId]: { ...prev[socketId], camOn: video, micOn: audio } })))
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
  }, [isHost, isPrivateRoom, waitingStatus])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── All original handlers (untouched) ───────────────────────
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
        const ss = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        screenRef.current = ss
        const track = ss.getVideoTracks()[0]
        await pcmRef.current?.replaceTrack('video', track)
        if (videoRef.current) videoRef.current.srcObject = ss
        track.onended = stopScreen
        socketRef.current?.emit('screen-share-started')
        setScreenOn(true); showToast('Screen sharing started')
      } catch { showToast('Screen share cancelled') }
    } else { stopScreen() }
  }
  const stopScreen = async () => {
    screenRef.current?.getTracks().forEach(t => t.stop())
    const camTrack = streamRef.current?.getVideoTracks()[0]
    if (camTrack) await pcmRef.current?.replaceTrack('video', camTrack)
    if (videoRef.current) videoRef.current.srcObject = streamRef.current
    socketRef.current?.emit('screen-share-stopped')
    setScreenOn(false); showToast('Screen sharing stopped')
  }
  const toggleHand = () => {
    const next = !handRaised; setHandRaised(next)
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
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SR) { showToast('Speech recognition not supported'); return }
      const r = new SR(); r.continuous = true; r.interimResults = false; r.lang = 'en-US'
      r.onresult = (e) => {
        const text = e.results[e.results.length - 1][0].transcript
        setTranscript(t => [...t, { speaker: user?.displayName || 'You', text, ts: Date.now() }])
      }
      r.onerror = () => setTranscribing(false)
      r.start(); recognitionRef.current = r; setTranscribing(true); showToast('Transcription started')
    } else {
      recognitionRef.current?.stop(); setTranscribing(false); showToast('Transcription stopped')
    }
  }
  const downloadTranscript = () => {
    const text = transcript.map(t => `[${new Date(t.ts).toLocaleTimeString()}] ${t.speaker}: ${t.text}`).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    a.download = `nexmeet-transcript-${roomId}.txt`; a.click()
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
    recognitionRef.current?.stop()
    setShowFeedback(true)
  }
  const handleFeedbackSubmit = (data) => { console.log('[NexMeet] Meeting feedback:', data) }
  const handleFeedbackClose  = () => { setShowFeedback(false); navigate('/rooms') }

  const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
  const peerList        = Object.entries(peers)
  const allParticipants = [
    { name: user?.displayName || 'You', isLocal: true, handRaised },
    ...peerList.map(([, p]) => ({ name: p.displayName || 'Guest', isLocal: false, handRaised: p.handRaised }))
  ]

  // ── mobile drawer toggle helpers ────────────────────────────
  const toggleMobileChat    = () => setMobileDrawer(d => d === 'chat'   ? null : 'chat')
  const toggleMobilePeople  = () => setMobileDrawer(d => d === 'people' ? null : 'people')
  const closeMobileDrawer   = () => setMobileDrawer(null)

  // ── 1. Loading screen ────────────────────────────────────────
  if (isHost === null || isPrivateRoom === null) {
    return (
      <div style={{ height: '100vh', background: '#04040a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, position: 'relative', overflow: 'hidden' }}>
        <HexGrid />
        <AmbientOrbs />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } } @keyframes orbDrift1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,-20px)} } @keyframes orbDrift2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-20px,30px)} } @keyframes orbDrift3 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(15px,-15px)} }`}</style>
        <div style={{ position: 'relative', zIndex: 10 }}>
          <div style={{ width: 56, height: 56, border: '2px solid rgba(124,58,237,0.2)', borderTop: '2px solid #7c3aed', borderRadius: '50%', animation: 'spin 0.9s linear infinite', boxShadow: '0 0 20px rgba(124,58,237,0.3)' }} />
        </div>
        <div style={{ textAlign: 'center', zIndex: 10 }}>
          <p style={{ color: '#a78bfa', fontSize: '0.78rem', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'monospace' }}>Initializing holographic space…</p>
        </div>
      </div>
    )
  }

  // ── 2. Waiting room (unchanged) ──────────────────────────────
  if (isHost === false && isPrivateRoom === true && waitingStatus !== 'admitted') {
    return (
      <WaitingRoom roomId={roomId} user={user} isHost={false} onAdmitted={() => {}} onDenied={() => navigate('/rooms')} />
    )
  }

  // ── 3. HOLOGRAPHIC MAIN ROOM ─────────────────────────────────
  return (
    <>
      {/* ── All keyframe animations ─────────────────────────── */}
      <style>{`
        @keyframes floatUp      { 0%   { transform:translateY(0) scale(1);   opacity:1; } 100% { transform:translateY(-200px) scale(1.5); opacity:0; } }
        @keyframes nm-pulse-dot { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(0.8); } }
        @keyframes scanMove     { 0% { backgroundPosition:0 0; } 100% { backgroundPosition:0 100px; } }
        @keyframes orbDrift1    { 0%,100%{transform:translate(0,0)} 50%{transform:translate(40px,-30px)} }
        @keyframes orbDrift2    { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-30px,40px)} }
        @keyframes orbDrift3    { 0%,100%{transform:translate(0,0)} 50%{transform:translate(20px,-20px)} }
        @keyframes audioRing    { 0% { transform:scale(1); opacity:0.5; } 100% { transform:scale(2); opacity:0; } }
        @keyframes holoShimmer  { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
        @keyframes tileEntrance { from { opacity:0; transform:translateY(20px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes controlEntrance { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
        @keyframes glowPulse    { 0%,100% { box-shadow:0 0 20px rgba(124,58,237,0.3),0 0 40px rgba(124,58,237,0.1); } 50% { box-shadow:0 0 30px rgba(124,58,237,0.5),0 0 60px rgba(124,58,237,0.2); } }
        @keyframes borderGlow   { 0%,100% { border-color:rgba(124,58,237,0.35); } 50% { border-color:rgba(167,139,250,0.65); } }
        @keyframes spin         { to { transform:rotate(360deg); } }
        @keyframes dataFlow     { 0% { strokeDashoffset:100; } 100% { strokeDashoffset:0; } }
        @keyframes slideUp      { from { transform:translateY(100%); opacity:0; } to { transform:translateY(0); opacity:1; } }

        .holo-tile {
          animation: tileEntrance 0.5s ease both;
          transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease;
        }
        .holo-tile:hover {
          transform: translateY(-4px) scale(1.015);
          box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 30px rgba(124,58,237,0.15);
        }
        .ctrl-btn {
          transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1);
          animation: controlEntrance 0.4s ease both;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .ctrl-btn:hover { transform: translateY(-3px) scale(1.08); }
        .ctrl-btn:active { transform: translateY(0) scale(0.95); }

        .holo-panel {
          background: rgba(4,4,14,0.96);
          backdrop-filter: blur(24px);
          border-left: 0.5px solid rgba(124,58,237,0.2);
        }
        .chat-input:focus { border-color: rgba(124,58,237,0.6) !important; box-shadow: 0 0 0 2px rgba(124,58,237,0.1); }

        /* ── MOBILE DRAWER (slides up from bottom) ── */
        .mobile-drawer {
          display: none;
        }

        /* ── MOBILE OVERRIDES ── */
        @media (max-width: 768px) {

          /* Hide desktop side panels — use mobile drawer instead */
          .holo-panel { display: none !important; }

          /* Mobile drawer shown as bottom sheet */
          .mobile-drawer {
            display: flex;
            flex-direction: column;
            position: fixed;
            left: 0; right: 0; bottom: 0;
            height: 65vh;
            background: rgba(4,4,14,0.98);
            border-top: 0.5px solid rgba(124,58,237,0.3);
            border-radius: 20px 20px 0 0;
            z-index: 5000;
            animation: slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1);
            overflow: hidden;
          }

          /* Control bar: two rows, wraps naturally */
          .nm-controls-bar {
            height: auto !important;
            min-height: 80px !important;
            padding: 10px 8px 14px !important;
            flex-wrap: wrap !important;
            gap: 6px !important;
            justify-content: center !important;
            align-content: center !important;
          }

          /* Make every button slightly smaller but still thumb-friendly */
          .ctrl-btn {
            width: 52px !important;
            height: 58px !important;
            border-radius: 12px !important;
          }

          /* Leave button — always visible, slightly larger */
          .nm-leave-btn {
            width: 58px !important;
            height: 58px !important;
            border-radius: 12px !important;
          }

          /* Dividers take no space on mobile */
          .nm-holo-divider { display: none !important; }

          /* Top bar: hide room-id and secondary chips, keep essentials */
          .nm-topbar-roomid  { display: none !important; }
          .nm-topbar-private { display: none !important; }
          .nm-topbar-copy    { display: none !important; }

          /* Timer stays centered */
          .nm-topbar-timer { font-size: 0.72rem !important; }

          /* Reaction picker goes above controls on mobile */
          .nm-reaction-picker {
            bottom: 116px !important;
            left: 8px !important;
            right: 8px !important;
            transform: none !important;
            justify-content: space-around !important;
          }

          /* Video grid full-width */
          .nm-video-grid {
            padding: 0.5rem !important;
          }

          /* Holo-tile hover effect off on mobile (no mouse) */
          .holo-tile:hover {
            transform: none !important;
            box-shadow: none !important;
          }
        }

        @media (max-width: 480px) {
          .ctrl-btn {
            width: 46px !important;
            height: 52px !important;
            border-radius: 10px !important;
          }
          .nm-leave-btn {
            width: 52px !important;
            height: 52px !important;
          }
          .nm-controls-bar {
            gap: 4px !important;
            padding: 8px 4px 12px !important;
          }
        }
      `}</style>

      {/* ── Background layers ──────────────────────────────── */}
      <HexGrid />
      <AmbientOrbs />
      <HoloScanlines />

      {/* ── Overlaid UI components (logic unchanged) ───────── */}
      <RejoinBanner rejoinData={rejoinData} onRejoin={confirmRejoin} onDismiss={clearRejoin} />
      {isHost === true && <AdmitPanel waitingUsers={waitingUsers} onAdmit={admitUser} onDeny={denyUser} />}

      {reactions.map(r => (
        <FloatingReaction key={r.id} emoji={r.emoji} name={r.name}
          onDone={() => setReactions(prev => prev.filter(x => x.id !== r.id))} />
      ))}

      {/* ── Holographic toast ───────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(4,4,14,0.96)', border: '0.5px solid rgba(124,58,237,0.4)',
          borderRadius: 100, padding: '8px 22px', fontSize: '0.8rem', color: '#c4b5fd',
          zIndex: 9998, backdropFilter: 'blur(20px)',
          boxShadow: '0 4px 30px rgba(124,58,237,0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', gap: 8,
          animation: 'tileEntrance 0.2s ease',
          maxWidth: 'calc(100vw - 32px)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#7c3aed', display: 'inline-block', boxShadow: '0 0 6px #7c3aed', flexShrink: 0 }} />
          {toast}
        </div>
      )}

      <MeetingFeedback isOpen={showFeedback} onClose={handleFeedbackClose} onSubmit={handleFeedbackSubmit} duration={elapsed} roomId={roomId} />

      {/* ── MOBILE DRAWERS (bottom sheets) ──────────────────── */}
      {mobileDrawer === 'chat' && (
        <div className="mobile-drawer">
          <div style={{ padding: '12px 16px 10px', borderBottom: '0.5px solid rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: 6 }}>
              <MessageCircle size={15} fill="#a78bfa" /> Chat
            </span>
            <button onClick={closeMobileDrawer} style={{ background: 'none', border: 'none', color: 'rgba(167,139,250,0.5)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ flex: 1, padding: '0.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.length === 0
              ? <p style={{ fontSize: '0.82rem', color: 'rgba(167,139,250,0.25)', textAlign: 'center', marginTop: '2rem' }}>No messages yet.</p>
              : messages.map((m, i) => (
                <div key={i}>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(167,139,250,0.4)', marginBottom: 2 }}>{m.from}</div>
                  <div style={{ fontSize: '0.85rem', color: 'rgba(228,228,247,0.85)', background: 'rgba(124,58,237,0.06)', padding: '8px 12px', borderRadius: 10, border: '0.5px solid rgba(124,58,237,0.15)' }}>{m.text}</div>
                </div>
              ))
            }
            <div ref={chatEndRef} />
          </div>
          <div style={{ padding: '10px 12px', borderTop: '0.5px solid rgba(124,58,237,0.15)', display: 'flex', gap: 8, flexShrink: 0, paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
            <input
              className="chat-input"
              style={{ flex: 1, padding: '10px 13px', fontSize: '16px', background: 'rgba(124,58,237,0.05)', border: '0.5px solid rgba(124,58,237,0.2)', borderRadius: 10, color: '#e4e4f7', outline: 'none', fontFamily: 'inherit', transition: 'all 0.2s' }}
              placeholder="Send a message…"
              value={chatMsg}
              onChange={e => setChatMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
            />
            <button onClick={sendChat} style={{ width: 42, height: 42, borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ArrowUp size={18} />
            </button>
          </div>
        </div>
      )}

      {mobileDrawer === 'people' && (
        <div className="mobile-drawer">
          <div style={{ padding: '12px 16px 10px', borderBottom: '0.5px solid rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={15} /> Participants <span style={{ fontSize: '0.72rem', color: 'rgba(167,139,250,0.5)', background: 'rgba(124,58,237,0.1)', padding: '1px 8px', borderRadius: 100, marginLeft: 4 }}>{allParticipants.length}</span>
            </span>
            <button onClick={closeMobileDrawer} style={{ background: 'none', border: 'none', color: 'rgba(167,139,250,0.5)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            {allParticipants.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(124,58,237,0.04)', border: '0.5px solid rgba(124,58,237,0.12)' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 700, flexShrink: 0 }}>{p.name[0].toUpperCase()}</div>
                <span style={{ fontSize: '0.85rem', flex: 1, color: '#e4e4f7' }}>{p.name}{p.isLocal ? <span style={{ color: 'rgba(167,139,250,0.5)', fontSize: '0.75rem' }}> (you)</span> : ''}</span>
                {p.handRaised && <Hand size={14} color="#facc15" fill="#facc15" />}
                {p.isLocal && isHost && <span style={{ fontSize: '0.62rem', color: '#facc15', background: 'rgba(250,204,21,0.08)', border: '0.5px solid rgba(250,204,21,0.2)', borderRadius: 100, padding: '2px 8px' }}>Host</span>}
              </div>
            ))}
            {isHost && waitingUsers.length > 0 && (
              <>
                <div style={{ fontSize: '0.68rem', color: 'rgba(124,58,237,0.5)', padding: '8px 4px 4px', borderTop: '0.5px solid rgba(124,58,237,0.12)', marginTop: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Waiting to join</div>
                {waitingUsers.map(u => (
                  <div key={u.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(124,58,237,0.06)', border: '0.5px solid rgba(124,58,237,0.2)' }}>
                    <img src={u.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName)}&background=7c3aed&color=fff`} alt={u.displayName} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.82rem', flex: 1, color: '#c4b5fd' }}>{u.displayName}</span>
                    <button onClick={() => admitUser(u.userId)} style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', color: '#fff', borderRadius: 8, padding: '5px 12px', fontSize: '0.75rem', cursor: 'pointer' }}>Admit</button>
                    <button onClick={() => denyUser(u.userId)} style={{ background: 'none', border: '0.5px solid rgba(239,68,68,0.25)', color: 'rgba(248,113,113,0.7)', borderRadius: 8, padding: '5px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Root container ──────────────────────────────────── */}
      <div style={{ height: '100dvh', background: '#04040a', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 2 }}>

        {/* ══ TOP BAR ══════════════════════════════════════════ */}
        <div style={{
          height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 1rem',
          background: 'rgba(4,4,14,0.92)',
          borderBottom: '0.5px solid rgba(124,58,237,0.2)',
          backdropFilter: 'blur(20px)',
          flexShrink: 0,
          boxShadow: '0 1px 0 rgba(124,58,237,0.08), 0 4px 24px rgba(0,0,0,0.4)',
        }}>
          {/* Left — branding */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, flexShrink: 0 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#7c3aed', boxShadow: '0 0 10px rgba(124,58,237,0.9)', animation: 'holoShimmer 2s ease-in-out infinite' }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(124,58,237,0.3)', animation: 'audioRing 3s ease-out infinite' }} />
            </div>
            <span style={{ fontWeight: 800, fontSize: '0.88rem', letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #e4e4f7, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', flexShrink: 0 }}>NexMeet</span>

            <span className="nm-topbar-roomid" style={{ fontSize: '0.7rem', color: 'rgba(167,139,250,0.4)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{roomId}</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.65rem', color: 'rgba(167,139,250,0.7)', background: 'rgba(124,58,237,0.08)', padding: '2px 8px', borderRadius: 100, border: '0.5px solid rgba(124,58,237,0.2)', flexShrink: 0 }}>
              <Users size={10} />
              {allParticipants.length}
            </div>

            {isPrivateRoom && (
              <span className="nm-topbar-private" style={{ fontSize: '0.62rem', color: '#a78bfa', background: 'rgba(124,58,237,0.08)', border: '0.5px solid rgba(124,58,237,0.25)', padding: '2px 8px', borderRadius: 100, flexShrink: 0 }}>🔒</span>
            )}
            {isHost && waitingUsers.length > 0 && (
              <span style={{ fontSize: '0.65rem', color: '#a78bfa', background: 'rgba(124,58,237,0.1)', border: '0.5px solid rgba(124,58,237,0.3)', padding: '2px 8px', borderRadius: 100, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#a78bfa', display: 'inline-block', animation: 'nm-pulse-dot 1.5s infinite' }} />
                {waitingUsers.length}
              </span>
            )}
          </div>

          {/* Center — timer */}
          <div className="nm-topbar-timer" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.06)', border: '0.5px solid rgba(239,68,68,0.18)', borderRadius: 100, padding: '4px 12px', flexShrink: 0 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'nm-pulse-dot 2s infinite', boxShadow: '0 0 6px #ef4444' }} />
            <span style={{ fontSize: '0.78rem', color: '#f87171', fontFamily: 'monospace', letterSpacing: '0.1em' }}>{fmt(elapsed)}</span>
          </div>

          {/* Right — copy link (hidden on mobile) */}
          <button
            className="nm-topbar-copy"
            onClick={() => { navigator.clipboard.writeText(window.location.href).catch(()=>{}); showToast('Room link copied!') }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(124,58,237,0.06)', border: '0.5px solid rgba(124,58,237,0.25)', color: 'rgba(167,139,250,0.7)', borderRadius: 10, padding: '6px 14px', fontSize: '0.78rem', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.12)'; e.currentTarget.style.color = '#c4b5fd' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.06)'; e.currentTarget.style.color = 'rgba(167,139,250,0.7)' }}
          >
            <Link size={14} strokeWidth={2.5} /> Copy Link
          </button>
        </div>

        {/* ══ MAIN AREA ════════════════════════════════════════ */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Video grid */}
          <div className="nm-video-grid" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', position: 'relative' }}>

            <div style={{ position: 'absolute', top: 16, left: 16, width: 40, height: 40, borderTop: '1px solid rgba(124,58,237,0.25)', borderLeft: '1px solid rgba(124,58,237,0.25)', borderRadius: '2px 0 0 0' }} />
            <div style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderTop: '1px solid rgba(124,58,237,0.25)', borderRight: '1px solid rgba(124,58,237,0.25)', borderRadius: '0 2px 0 0' }} />
            <div style={{ position: 'absolute', bottom: 16, left: 16, width: 40, height: 40, borderBottom: '1px solid rgba(124,58,237,0.25)', borderLeft: '1px solid rgba(124,58,237,0.25)', borderRadius: '0 0 0 2px' }} />
            <div style={{ position: 'absolute', bottom: 16, right: 16, width: 40, height: 40, borderBottom: '1px solid rgba(124,58,237,0.25)', borderRight: '1px solid rgba(124,58,237,0.25)', borderRadius: '0 0 2px 0' }} />

            <div style={{
              width: '100%', maxWidth: 980,
              display: 'grid',
              gridTemplateColumns: peerList.length === 0 ? '1fr' : peerList.length === 1 ? 'repeat(2,1fr)' : 'repeat(auto-fit, minmax(280px,1fr))',
              gap: '0.9rem',
            }}>
              <VideoTile
                name={user?.displayName || 'You'} isLocal
                videoRef={videoRef} stream={streamRef.current}
                camOn={camOn} micOn={micOn} handRaised={handRaised} isScreen={screenOn}
                tileIndex={0}
              />
              {peerList.map(([sid, { stream, displayName, handRaised: hr, micOn: pm }], idx) => (
                <RemoteVideoTile key={sid} name={displayName || 'Guest'} stream={stream}
                  handRaised={hr} micOn={pm} health={peerHealth[sid]?.health} tileIndex={idx + 1} />
              ))}
            </div>
          </div>

          {/* ── Desktop side panels (hidden on mobile, replaced by drawers) ── */}
          {participOpen && (
            <div className="holo-panel" style={{ width: 272, display: 'flex', flexDirection: 'column', animation: 'tileEntrance 0.25s ease' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '0.5px solid rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Users size={14} /> Participants <span style={{ fontSize: '0.7rem', color: 'rgba(167,139,250,0.5)', background: 'rgba(124,58,237,0.1)', padding: '1px 7px', borderRadius: 100 }}>{allParticipants.length}</span>
                </span>
                <button onClick={() => setParticipOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(167,139,250,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={16} /></button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {allParticipants.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(124,58,237,0.04)', border: '0.5px solid rgba(124,58,237,0.12)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, flexShrink: 0 }}>{p.name[0].toUpperCase()}</div>
                    <span style={{ fontSize: '0.8rem', flex: 1, color: '#e4e4f7' }}>{p.name}{p.isLocal ? <span style={{ color: 'rgba(167,139,250,0.5)', fontSize: '0.72rem' }}> (you)</span> : ''}</span>
                    {p.handRaised && <Hand size={13} color="#facc15" fill="#facc15" />}
                    {p.isLocal && isHost && <span style={{ fontSize: '0.6rem', color: '#facc15', background: 'rgba(250,204,21,0.08)', border: '0.5px solid rgba(250,204,21,0.2)', borderRadius: 100, padding: '1px 7px' }}>Host</span>}
                  </div>
                ))}
                {isHost && waitingUsers.length > 0 && (
                  <>
                    <div style={{ fontSize: '0.67rem', color: 'rgba(124,58,237,0.5)', padding: '8px 4px 4px', borderTop: '0.5px solid rgba(124,58,237,0.12)', marginTop: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Waiting</div>
                    {waitingUsers.map(u => (
                      <div key={u.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(124,58,237,0.06)', border: '0.5px solid rgba(124,58,237,0.2)' }}>
                        <img src={u.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName)}&background=7c3aed&color=fff`} alt={u.displayName} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.78rem', flex: 1, color: '#c4b5fd' }}>{u.displayName}</span>
                        <button onClick={() => admitUser(u.userId)} style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', color: '#fff', borderRadius: 6, padding: '3px 10px', fontSize: '0.7rem', cursor: 'pointer' }}>Admit</button>
                        <button onClick={() => denyUser(u.userId)} style={{ background: 'none', border: '0.5px solid rgba(239,68,68,0.25)', color: 'rgba(248,113,113,0.6)', borderRadius: 6, padding: '3px 8px', fontSize: '0.7rem', cursor: 'pointer' }}>✕</button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {transcript.length > 0 && (
            <div className="holo-panel" style={{ width: 280, display: 'flex', flexDirection: 'column', animation: 'tileEntrance 0.25s ease' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '0.5px solid rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: 6 }}><Type size={14} /> Transcript</span>
                <button onClick={downloadTranscript} style={{ background: 'none', border: '0.5px solid rgba(124,58,237,0.3)', color: '#a78bfa', cursor: 'pointer', fontSize: '0.72rem', borderRadius: 6, padding: '3px 10px' }}>Download</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {transcript.map((t, i) => (
                  <div key={i}>
                    <div style={{ fontSize: '0.67rem', color: 'rgba(167,139,250,0.4)', marginBottom: 2 }}>{t.speaker} · {new Date(t.ts).toLocaleTimeString()}</div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(228,228,247,0.8)', background: 'rgba(124,58,237,0.06)', padding: '7px 10px', borderRadius: 8, border: '0.5px solid rgba(124,58,237,0.12)' }}>{t.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {chatOpen && (
            <div className="holo-panel" style={{ width: 300, display: 'flex', flexDirection: 'column', animation: 'tileEntrance 0.25s ease' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '0.5px solid rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MessageCircle size={14} fill="#a78bfa" /> Chat
                  {encryptionStatus?.enabled && <span style={{ fontSize: '0.6rem', color: '#22c55e', background: 'rgba(34,197,94,0.08)', border: '0.5px solid rgba(34,197,94,0.2)', borderRadius: 100, padding: '1px 7px' }}>🔐 E2E</span>}
                </span>
                <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(167,139,250,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={16} /></button>
              </div>
              <div style={{ flex: 1, padding: '0.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {messages.length === 0
                  ? <p style={{ fontSize: '0.78rem', color: 'rgba(167,139,250,0.25)', textAlign: 'center', marginTop: '2rem' }}>No messages yet.</p>
                  : messages.map((m, i) => (
                    <div key={i}>
                      <div style={{ fontSize: '0.67rem', color: 'rgba(167,139,250,0.4)', marginBottom: 2 }}>{m.from}</div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(228,228,247,0.85)', background: 'rgba(124,58,237,0.06)', padding: '8px 12px', borderRadius: 10, border: '0.5px solid rgba(124,58,237,0.15)' }}>{m.text}</div>
                    </div>
                  ))
                }
                <div ref={chatEndRef} />
              </div>
              <div style={{ padding: '0.75rem', borderTop: '0.5px solid rgba(124,58,237,0.15)', display: 'flex', gap: 8 }}>
                <input
                  className="chat-input"
                  style={{ flex: 1, padding: '9px 13px', fontSize: '0.82rem', background: 'rgba(124,58,237,0.05)', border: '0.5px solid rgba(124,58,237,0.2)', borderRadius: 10, color: '#e4e4f7', outline: 'none', fontFamily: 'inherit', transition: 'all 0.2s' }}
                  placeholder="Send a message…"
                  value={chatMsg}
                  onChange={e => setChatMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                />
                <button onClick={sendChat} style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowUp size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ══ HOLOGRAPHIC CONTROLS BAR ═════════════════════════ */}
        <div className="nm-controls-bar" style={{
          height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 5, flexShrink: 0, padding: '0 1rem', position: 'relative',
          background: 'rgba(4,4,14,0.97)',
          borderTop: '0.5px solid rgba(124,58,237,0.2)',
          boxShadow: '0 -1px 0 rgba(124,58,237,0.08), 0 -20px 60px rgba(4,4,14,0.8)',
          backdropFilter: 'blur(20px)',
          paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
          overflowX: 'visible',
        }}>
          {/* Subtle top glow line */}
          <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)', pointerEvents: 'none' }} />

          {/* Reaction picker */}
          {showReactionPicker && (
            <div className="nm-reaction-picker" style={{
              position: 'absolute', bottom: 104, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(4,4,14,0.98)', border: '0.5px solid rgba(124,58,237,0.3)',
              borderRadius: 20, padding: '12px 16px', display: 'flex', gap: 4, zIndex: 100,
              boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(124,58,237,0.1)',
              backdropFilter: 'blur(24px)',
              animation: 'tileEntrance 0.2s ease',
            }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => sendReaction(e)} style={{ background: 'none', border: 'none', fontSize: '1.6rem', cursor: 'pointer', borderRadius: 12, padding: '6px 8px', transition: 'transform 0.15s', WebkitTapHighlightColor: 'transparent' }}
                  onMouseEnter={ev => ev.currentTarget.style.transform = 'scale(1.4)'}
                  onMouseLeave={ev => ev.currentTarget.style.transform = 'scale(1)'}
                >{e}</button>
              ))}
            </div>
          )}

          {/* ── Core media controls — always visible ── */}
          <ControlBtn active={micOn}    danger={!micOn}  onClick={toggleMic}    icon={micOn    ? <Mic size={19} />      : <MicOff size={19} />}    label={micOn    ? 'Mute'    : 'Unmute'}  delay={0}   />
          <ControlBtn active={camOn}    danger={!camOn}  onClick={toggleCam}    icon={camOn    ? <Video size={19} />    : <VideoOff size={19} />}   label={camOn    ? 'Camera'  : 'No cam'}  delay={0.04}/>
          <ControlBtn active={screenOn}                  onClick={toggleScreen} icon={screenOn ? <MonitorUp size={19}/> : <Monitor size={19} />}    label={screenOn ? 'Sharing' : 'Share'}   delay={0.08}/>

          <HoloDivider />

          {/* ── Chat — desktop uses side panel, mobile uses drawer ── */}
          <ControlBtn
            active={chatOpen || mobileDrawer === 'chat'}
            onClick={() => {
              // On mobile, open drawer; on desktop, open side panel
              if (window.innerWidth <= 768) {
                toggleMobileChat()
                setParticipOpen(false)
              } else {
                setChatOpen(c => !c)
                setParticipOpen(false)
              }
            }}
            icon={<MessageCircle size={19} fill={(chatOpen || mobileDrawer === 'chat') ? 'currentColor' : 'none'} />}
            label="Chat"
            badge={messages.length}
            delay={0.12}
          />
          <ControlBtn
            active={participOpen || mobileDrawer === 'people'}
            onClick={() => {
              if (window.innerWidth <= 768) {
                toggleMobilePeople()
                setChatOpen(false)
              } else {
                setParticipOpen(p => !p)
                setChatOpen(false)
              }
            }}
            icon={<Users size={19} />}
            label="People"
            badge={allParticipants.length}
            delay={0.16}
          />
          <ControlBtn active={handRaised}   highlight={handRaised} onClick={toggleHand}                    icon={<Hand size={19} fill={handRaised ? 'currentColor' : 'none'} />}         label={handRaised ? 'Lower' : 'Raise'}      delay={0.20}/>
          <ControlBtn active={showReactionPicker} onClick={() => setShowReactionPicker(r=>!r)}              icon={<Smile size={19} fill={showReactionPicker ? 'currentColor' : 'none'} />} label="React"                               delay={0.24}/>
          <ControlBtn active={transcribing}  pulse={transcribing} onClick={toggleTranscription}             icon={<Type size={19} />}                                                     label={transcribing ? 'Live' : 'Notes'}     delay={0.28}/>

          <HoloDivider />

          <RoomFeaturesToolbar quality={quality} isAuto={isAuto} setManualQuality={handleSetManualQuality} enableAuto={handleEnableAuto} health={overallHealth} stats={stats} encryptionStatus={encryptionStatus} />

          <HoloDivider />

          {/* ── Leave — always visible, always prominent ── */}
          <LeaveBtn onClick={handleLeave} />
        </div>
      </div>
    </>
  )
}

/* ─── Remote video tile wrapper (unchanged logic) ─────────── */
function RemoteVideoTile({ name, stream, handRaised, micOn, health, tileIndex }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current && stream) ref.current.srcObject = stream }, [stream])
  return <VideoTile name={name} isLocal={false} videoRef={ref} stream={stream} camOn={!!stream} micOn={micOn !== false} handRaised={handRaised} health={health} tileIndex={tileIndex} />
}

/* ─── HOLOGRAPHIC VIDEO TILE ──────────────────────────────── */
function VideoTile({ name, isLocal, videoRef, stream, camOn, micOn, handRaised, isScreen, health, tileIndex = 0 }) {
  useEffect(() => {
    if (isLocal && videoRef?.current && stream) videoRef.current.srcObject = stream
  }, [isLocal, stream, videoRef])

  const isSpeaking = micOn && !isLocal

  const borderColor =
    health === 'poor'     ? 'rgba(239,68,68,0.6)'   :
    health === 'degraded' ? 'rgba(245,158,11,0.5)'  :
    handRaised            ? 'rgba(250,204,21,0.6)'  :
    isSpeaking            ? 'rgba(124,58,237,0.6)'  :
                            'rgba(124,58,237,0.18)'

  const glowColor =
    health === 'poor'     ? 'rgba(239,68,68,0.15)'   :
    health === 'degraded' ? 'rgba(245,158,11,0.12)'  :
    handRaised            ? 'rgba(250,204,21,0.12)'  :
                            'rgba(124,58,237,0.08)'

  return (
    <div
      className="holo-tile"
      style={{
        aspectRatio: '16/9',
        borderRadius: 16,
        background: '#060614',
        overflow: 'hidden',
        position: 'relative',
        border: `1px solid ${borderColor}`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,58,237,0.05), inset 0 1px 0 rgba(255,255,255,0.03), 0 0 30px ${glowColor}`,
        transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
        animationDelay: `${tileIndex * 0.08}s`,
      }}
    >
      {isSpeaking && <AudioRing active color="rgba(124,58,237,0.5)" size={70} />}
      <CornerBrackets color={borderColor} size={14} />

      {camOn
        ? <video ref={videoRef} autoPlay muted={isLocal} playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: (isLocal && !isScreen) ? 'scaleX(-1)' : 'none' }}
          />
        : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800, boxShadow: '0 0 30px rgba(124,58,237,0.4)', border: '1px solid rgba(167,139,250,0.3)' }}>{name[0].toUpperCase()}</div>
              <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: '1px dashed rgba(124,58,237,0.25)', animation: 'spin 6s linear infinite' }}>
                <div style={{ position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#7c3aed', boxShadow: '0 0 6px #7c3aed' }} />
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'rgba(167,139,250,0.5)', letterSpacing: '0.05em' }}>{name}</span>
          </div>
        )
      }

      {handRaised && (
        <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(250,204,21,0.12)', border: '0.5px solid rgba(250,204,21,0.4)', borderRadius: 100, padding: '4px 10px', fontSize: '0.7rem', color: '#facc15', display: 'flex', alignItems: 'center', gap: 5, backdropFilter: 'blur(8px)' }}>
          <Hand size={11} fill="#facc15" /> Hand raised
        </div>
      )}

      {!isLocal && health && health !== 'good' && (
        <div style={{ position: 'absolute', top: 10, left: 10, background: health === 'poor' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', border: `0.5px solid ${health === 'poor' ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}`, borderRadius: 100, padding: '4px 10px', fontSize: '0.68rem', color: health === 'poor' ? '#ef4444' : '#f59e0b', display: 'flex', alignItems: 'center', gap: 5, backdropFilter: 'blur(8px)' }}>
          {health === 'poor' ? <WifiOff size={11} /> : <Wifi size={11} />} {health === 'poor' ? 'Poor' : 'Unstable'}
        </div>
      )}

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 10px 10px', background: 'linear-gradient(transparent, rgba(4,4,14,0.85))', display: 'flex', alignItems: 'center', gap: 6 }}>
        {!micOn && <MicOff size={11} color="#f87171" />}
        <span style={{ fontSize: '0.7rem', color: 'rgba(228,228,247,0.8)', letterSpacing: '0.02em' }}>{isLocal ? `${name} (you)` : name}</span>
        {isLocal && <span style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />}
      </div>
    </div>
  )
}

/* ─── HOLOGRAPHIC CONTROL BUTTON ──────────────────────────── */
function ControlBtn({ active, danger, highlight, pulse, onClick, icon, label, badge, delay = 0 }) {
  const bg     = danger     ? 'rgba(239,68,68,0.1)'     : highlight ? 'rgba(250,204,21,0.08)'  : active ? 'rgba(124,58,237,0.14)' : 'rgba(255,255,255,0.03)'
  const border = danger     ? 'rgba(239,68,68,0.4)'     : highlight ? 'rgba(250,204,21,0.35)'  : active ? 'rgba(124,58,237,0.45)' : 'rgba(124,58,237,0.15)'
  const color  = danger     ? '#f87171'                 : highlight ? '#facc15'                : active ? '#c4b5fd'               : 'rgba(167,139,250,0.55)'
  const glow   = danger     ? '0 0 16px rgba(239,68,68,0.2)' : active ? '0 0 16px rgba(124,58,237,0.2)' : 'none'

  return (
    <button onClick={onClick} className="ctrl-btn" title={label}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, width: 56, height: 66, borderRadius: 14, background: bg, border: `0.5px solid ${border}`, cursor: 'pointer', position: 'relative', color, outline: 'none', boxShadow: glow, animationDelay: `${delay}s`, WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', flexShrink: 0 }}
      onMouseEnter={e => { e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.18)' : 'rgba(124,58,237,0.2)'; e.currentTarget.style.borderColor = danger ? 'rgba(239,68,68,0.6)' : 'rgba(167,139,250,0.5)' }}
      onMouseLeave={e => { e.currentTarget.style.background = bg; e.currentTarget.style.borderColor = border }}
    >
      {icon}
      <span style={{ fontSize: '0.55rem', color, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      {pulse  && <span style={{ position: 'absolute', top: 6, right: 6, width: 5, height: 5, borderRadius: '50%', background: '#f87171', animation: 'nm-pulse-dot 1s infinite', boxShadow: '0 0 6px #f87171' }} />}
      {badge > 0 && <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 100, background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', fontSize: '0.55rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', boxShadow: '0 0 8px rgba(124,58,237,0.5)' }}>{badge > 99 ? '99+' : badge}</span>}
    </button>
  )
}

/* ─── LEAVE BUTTON ────────────────────────────────────────── */
function LeaveBtn({ onClick }) {
  return (
    <button onClick={onClick} className="ctrl-btn nm-leave-btn"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, width: 64, height: 66, borderRadius: 14, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.5)', cursor: 'pointer', color: '#f87171', outline: 'none', boxShadow: '0 0 20px rgba(239,68,68,0.15)', animationDelay: '0.4s', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', flexShrink: 0 }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.22)'; e.currentTarget.style.boxShadow = '0 0 30px rgba(239,68,68,0.3)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(239,68,68,0.15)' }}
    >
      <PhoneOff size={20} />
      <span style={{ fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Leave</span>
    </button>
  )
}

/* ─── HOLOGRAPHIC DIVIDER ─────────────────────────────────── */
function HoloDivider() {
  return (
    <div className="nm-holo-divider" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, margin: '0 3px', flexShrink: 0 }}>
      <div style={{ width: 1, height: 14, background: 'linear-gradient(transparent, rgba(124,58,237,0.35))' }} />
      <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(124,58,237,0.4)', boxShadow: '0 0 4px rgba(124,58,237,0.6)' }} />
      <div style={{ width: 1, height: 14, background: 'linear-gradient(rgba(124,58,237,0.35), transparent)' }} />
    </div>
  )
}