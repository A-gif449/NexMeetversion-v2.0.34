// src/pages/Room.jsx
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../firebase/AuthContext'
import { io } from 'socket.io-client'
import { PeerConnectionManager } from '../utils/webrtc'

export default function Room() {
  const { roomId }  = useParams()
  const { user }    = useAuth()
  const navigate    = useNavigate()

  const [micOn,    setMicOn]    = useState(true)
  const [camOn,    setCamOn]    = useState(true)
  const [screenOn, setScreenOn] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMsg,  setChatMsg]  = useState('')
  const [messages, setMessages] = useState([])
  const [elapsed,  setElapsed]  = useState(0)
  const [peers,    setPeers]    = useState({}) // socketId -> { stream, displayName }

  const videoRef  = useRef(null)
  const streamRef = useRef(null)
  const socketRef = useRef(null)
  const pcmRef    = useRef(null)

  // ── Socket + WebRTC setup ─────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(import.meta.env.VITE_BACKEND_URL)
    socketRef.current = socket

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream

        const pcm = new PeerConnectionManager({
          socket,
          localStream: stream,
          onTrack: (socketId, remoteStream) => {
            setPeers(prev => ({ ...prev, [socketId]: { ...prev[socketId], stream: remoteStream } }))
          },
          onConnectionStateChange: () => {}
        })
        pcmRef.current = pcm

        // Join the room
        socket.emit('join-room', { roomId, displayName: user?.displayName || 'Guest' })

        // Room joined — call all existing peers
        socket.on('room-joined', ({ existingPeers }) => {
          existingPeers.forEach(({ socketId, displayName }) => {
            setPeers(prev => ({ ...prev, [socketId]: { displayName } }))
            pcm.callPeer(socketId)
          })
        })

        // New peer joined
        socket.on('peer-joined', ({ socketId, displayName }) => {
          setPeers(prev => ({ ...prev, [socketId]: { displayName } }))
        })

        // WebRTC signaling
        socket.on('offer', ({ from, offer, displayName }) => {
          setPeers(prev => ({ ...prev, [from]: { ...prev[from], displayName } }))
          pcm.handleOffer(from, offer)
        })

        socket.on('answer', ({ from, answer }) => pcm.handleAnswer(from, answer))

        socket.on('ice-candidate', ({ from, candidate }) => pcm.handleIceCandidate(from, candidate))

        // Peer left
        socket.on('peer-left', ({ socketId }) => {
          pcm.removePeer(socketId)
          setPeers(prev => {
            const p = { ...prev }
            delete p[socketId]
            return p
          })
        })

        // Chat messages from others
        socket.on('chat-message', ({ displayName, message, timestamp }) => {
          setMessages(m => [...m, { from: displayName, text: message, ts: timestamp }])
        })
      })
      .catch(() => {})

    const timer = setInterval(() => setElapsed(e => e + 1), 1000)

    return () => {
      clearInterval(timer)
      socket.disconnect()
      pcmRef.current?.closeAll()
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [roomId])

  // ── Controls ──────────────────────────────────────────────────────────────
  const toggleMic = () => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !micOn })
    socketRef.current?.emit('media-state', { video: camOn, audio: !micOn })
    setMicOn(m => !m)
  }

  const toggleCam = () => {
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !camOn })
    socketRef.current?.emit('media-state', { video: !camOn, audio: micOn })
    setCamOn(c => !c)
  }

  const handleLeave = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    socketRef.current?.disconnect()
    pcmRef.current?.closeAll()
    navigate('/rooms')
  }

  const sendChat = () => {
    if (!chatMsg.trim()) return
    // Add locally
    setMessages(m => [...m, { from: user?.displayName || 'You', text: chatMsg.trim(), ts: Date.now() }])
    // Send to others via socket
    socketRef.current?.emit('chat-message', { message: chatMsg.trim() })
    setChatMsg('')
  }

  const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  const peerList = Object.entries(peers)

  return (
    <div style={{ height: '100vh', background: 'var(--bg-void)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{
        height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 1.25rem', background: 'rgba(5,5,8,0.9)',
        borderBottom: '0.5px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: 'var(--purple)',
            boxShadow: '0 0 8px var(--purple-glow)',
          }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem' }}>NexMeet</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-4)', letterSpacing: '0.05em' }}>|</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-3)', fontFamily: 'monospace' }}>{roomId}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>
            {peerList.length + 1} participant{peerList.length + 1 !== 1 ? 's' : ''}
          </span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(248,113,113,0.1)', border: '0.5px solid rgba(248,113,113,0.2)',
          borderRadius: 100, padding: '4px 12px',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)', animation: 'pulse-glow 2s infinite' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--danger)', fontFamily: 'monospace' }}>{fmt(elapsed)}</span>
        </div>

        <button onClick={() => {
          const link = window.location.href
          navigator.clipboard.writeText(link).catch(()=>{})
          alert('Room link copied!')
        }} className="btn btn-outline btn-sm">
          Copy Link
        </button>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Video grid */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: '#080810' }}>
          <div style={{
            width: '100%', maxWidth: 900,
            display: 'grid',
            gridTemplateColumns: peerList.length === 0
              ? '1fr'
              : peerList.length === 1
                ? 'repeat(2, 1fr)'
                : 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '0.75rem',
          }}>
            {/* Local video tile */}
            <VideoTile name={user?.displayName || 'You'} isLocal videoRef={videoRef} camOn={camOn} micOn={micOn} />

            {/* Remote peers */}
            {peerList.map(([socketId, { stream, displayName }]) => (
              <RemoteVideoTile key={socketId} name={displayName || 'Guest'} stream={stream} />
            ))}
          </div>
        </div>

        {/* Chat panel */}
        {chatOpen && (
          <div style={{
            width: 300, background: 'var(--bg-surface)',
            borderLeft: '0.5px solid var(--border)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '1rem', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Chat</span>
              <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
            </div>
            <div style={{ flex: 1, padding: '0.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {messages.length === 0
                ? <p style={{ fontSize: '0.78rem', color: 'var(--text-4)', textAlign: 'center', marginTop: '2rem' }}>No messages yet.</p>
                : messages.map((m, i) => (
                  <div key={i}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-4)', marginBottom: 2 }}>{m.from}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', background: 'var(--bg-card)', padding: '8px 10px', borderRadius: 'var(--radius-md)' }}>{m.text}</div>
                  </div>
                ))
              }
            </div>
            <div style={{ padding: '0.75rem', borderTop: '0.5px solid var(--border)', display: 'flex', gap: 8 }}>
              <input className="input-field" style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem' }}
                placeholder="Send a message…" value={chatMsg} onChange={e => setChatMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()} />
              <button className="btn btn-primary btn-sm" onClick={sendChat}>↑</button>
            </div>
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div style={{
        height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '0.75rem', background: 'rgba(5,5,8,0.95)',
        borderTop: '0.5px solid var(--border)', flexShrink: 0, padding: '0 1rem',
      }}>
        <ControlBtn active={micOn}    onClick={toggleMic}                label={micOn    ? '🎙️' : '🔇'} title={micOn    ? 'Mute'        : 'Unmute'} />
        <ControlBtn active={camOn}    onClick={toggleCam}                label={camOn    ? '📷' : '🚫'} title={camOn    ? 'Stop Camera' : 'Start Camera'} />
        <ControlBtn active={screenOn} onClick={() => setScreenOn(s=>!s)} label="🖥️"                    title="Share Screen" />
        <ControlBtn active={chatOpen} onClick={() => setChatOpen(c=>!c)} label="💬"                    title="Chat" badge={messages.length} />
        <ControlBtn active={false}    onClick={() => {}}                 label="😊"                    title="Reactions" />
        <ControlBtn active={false}    onClick={() => {}}                 label="⋯"                     title="More" />

        <div style={{ width: 1, height: 30, background: 'var(--border)', margin: '0 0.5rem' }} />

        <button onClick={handleLeave} className="btn btn-danger" style={{ padding: '10px 20px', fontSize: '0.85rem' }}>
          Leave
        </button>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RemoteVideoTile({ name, stream }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream
  }, [stream])

  return (
    <VideoTile name={name} isLocal={false} videoRef={ref} camOn={!!stream} micOn={true} />
  )
}

function VideoTile({ name, isLocal, videoRef, camOn, micOn }) {
  return (
    <div style={{
      aspectRatio: '16/9', borderRadius: 'var(--radius-lg)',
      background: '#0d0d18', overflow: 'hidden', position: 'relative',
      border: '0.5px solid var(--border)',
    }}>
      {camOn ? (
        <video ref={videoRef} autoPlay muted={isLocal} playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: isLocal ? 'scaleX(-1)' : 'none' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--purple), var(--blue))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700,
          }}>
            {name[0].toUpperCase()}
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>{name}</span>
        </div>
      )}

      {/* Name tag */}
      <div style={{
        position: 'absolute', bottom: 10, left: 10,
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(0,0,0,0.6)', borderRadius: 100, padding: '3px 10px',
      }}>
        {!micOn && <span style={{ fontSize: '0.7rem' }}>🔇</span>}
        <span style={{ fontSize: '0.72rem', color: '#fff' }}>{isLocal ? `${name} (you)` : name}</span>
      </div>
    </div>
  )
}

function ControlBtn({ active, onClick, label, title, badge }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 46, height: 46, borderRadius: '50%',
      background: active ? 'var(--purple-dim)' : 'rgba(255,255,255,0.05)',
      border: active ? '0.5px solid var(--border-purple)' : '0.5px solid var(--border)',
      cursor: 'pointer', fontSize: '1rem',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.2s', position: 'relative',
      boxShadow: active ? '0 0 12px var(--purple-glow)' : 'none',
    }}>
      {label}
      {badge > 0 && (
        <span style={{
          position: 'absolute', top: -2, right: -2,
          width: 16, height: 16, borderRadius: '50%',
          background: 'var(--purple)', color: '#fff',
          fontSize: '0.6rem', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{badge}</span>
      )}
    </button>
  )
}