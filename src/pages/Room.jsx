// src/pages/Room.jsx
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../firebase/AuthContext'
import { io } from 'socket.io-client'
import { PeerConnectionManager } from '../utils/webrtc'

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
  const { roomId }  = useParams()
  const { user }    = useAuth()
  const navigate    = useNavigate()

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

  const videoRef       = useRef(null)
  const streamRef      = useRef(null)
  const screenRef      = useRef(null)
  const socketRef      = useRef(null)
  const pcmRef         = useRef(null)
  const recognitionRef = useRef(null)
  const chatEndRef     = useRef(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    const socket = io(import.meta.env.VITE_BACKEND_URL)
    socketRef.current = socket

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream

        const pcm = new PeerConnectionManager({
          socket, localStream: stream,
          onTrack: (socketId, remoteStream) => {
            setPeers(prev => ({ ...prev, [socketId]: { ...prev[socketId], stream: remoteStream } }))
          },
          onConnectionStateChange: () => {}
        })
        pcmRef.current = pcm

        socket.emit('join-room', { roomId, displayName: user?.displayName || 'Guest' })

        socket.on('room-joined', ({ existingPeers }) => {
          existingPeers.forEach(({ socketId, displayName }) => {
            setPeers(prev => ({ ...prev, [socketId]: { displayName } }))
            pcm.callPeer(socketId)
          })
        })

        socket.on('peer-joined', ({ socketId, displayName }) => {
          setPeers(prev => ({ ...prev, [socketId]: { displayName } }))
          showToast(`${displayName} joined the room`)
        })

        socket.on('offer', ({ from, offer, displayName }) => {
          setPeers(prev => ({ ...prev, [from]: { ...prev[from], displayName } }))
          pcm.handleOffer(from, offer)
        })
        socket.on('answer',        ({ from, answer })    => pcm.handleAnswer(from, answer))
        socket.on('ice-candidate', ({ from, candidate }) => pcm.handleIceCandidate(from, candidate))

        socket.on('peer-left', ({ socketId }) => {
          setPeers(prev => {
            const name = prev[socketId]?.displayName || 'Someone'
            showToast(`${name} left the room`)
            const p = { ...prev }; delete p[socketId]; return p
          })
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
      })
      .catch(() => {})

    const timer = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => {
      clearInterval(timer)
      socket.disconnect()
      pcmRef.current?.closeAll()
      streamRef.current?.getTracks().forEach(t => t.stop())
      recognitionRef.current?.stop()
    }
  }, [roomId])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

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
      } catch (e) { showToast('Screen share cancelled') }
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
    showToast(next ? '✋ Hand raised' : 'Hand lowered')
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
      if (!SpeechRecognition) { showToast('Speech recognition not supported in this browser'); return }
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
      showToast('🎙️ Transcription started')
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

  return (
    <>
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-200px) scale(1.5); opacity: 0; }
        }
      `}</style>

      {reactions.map(r => (
        <FloatingReaction key={r.id} emoji={r.emoji} name={r.name}
          onDone={() => setReactions(prev => prev.filter(x => x.id !== r.id))} />
      ))}

      {toast && (
        <div style={{
          position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(20,20,30,0.95)', border: '0.5px solid var(--border-purple)',
          borderRadius: 100, padding: '8px 20px', fontSize: '0.82rem',
          color: 'var(--text-1)', zIndex: 9998, backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>{toast}</div>
      )}

      <div style={{ height: '100vh', background: 'var(--bg-void)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{
          height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 1.25rem', background: 'rgba(5,5,8,0.9)',
          borderBottom: '0.5px solid var(--border)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--purple)', boxShadow: '0 0 8px var(--purple-glow)' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem' }}>NexMeet</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>|</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-3)', fontFamily: 'monospace' }}>{roomId}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-4)', background: 'var(--bg-card)', padding: '2px 8px', borderRadius: 100, border: '0.5px solid var(--border)' }}>
              {allParticipants.length} participant{allParticipants.length !== 1 ? 's' : ''}
            </span>
            {transcribing && (
              <span style={{ fontSize: '0.7rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171', animation: 'pulse-glow 1s infinite' }} />
                Transcribing
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(248,113,113,0.1)', border: '0.5px solid rgba(248,113,113,0.2)', borderRadius: 100, padding: '4px 12px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)', animation: 'pulse-glow 2s infinite' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--danger)', fontFamily: 'monospace' }}>{fmt(elapsed)}</span>
          </div>

          <button onClick={() => { navigator.clipboard.writeText(window.location.href).catch(()=>{}); showToast('🔗 Room link copied!') }}
            className="btn btn-outline btn-sm">Copy Link</button>
        </div>

        {/* Main area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Video grid */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: '#080810' }}>
            <div style={{
              width: '100%', maxWidth: 960,
              display: 'grid',
              gridTemplateColumns: peerList.length === 0 ? '1fr' : peerList.length === 1 ? 'repeat(2,1fr)' : 'repeat(auto-fit, minmax(280px,1fr))',
              gap: '0.75rem',
            }}>
              <VideoTile name={user?.displayName || 'You'} isLocal videoRef={videoRef} camOn={camOn} micOn={micOn} handRaised={handRaised} isScreen={screenOn} />
              {peerList.map(([socketId, { stream, displayName, handRaised: hr, micOn: pm }]) => (
                <RemoteVideoTile key={socketId} name={displayName || 'Guest'} stream={stream} handRaised={hr} micOn={pm} />
              ))}
            </div>
          </div>

          {/* Participant panel */}
          {participOpen && (
            <div style={{ width: 260, background: 'var(--bg-surface)', borderLeft: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '1rem', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Participants ({allParticipants.length})</span>
                <button onClick={() => setParticipOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {allParticipants.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--purple), var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, flexShrink: 0 }}>
                      {p.name[0].toUpperCase()}
                    </div>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-1)', flex: 1 }}>{p.name}{p.isLocal ? ' (you)' : ''}</span>
                    {p.handRaised && <span>✋</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transcript panel */}
          {transcript.length > 0 && (
            <div style={{ width: 280, background: 'var(--bg-surface)', borderLeft: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '1rem', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>📝 Transcript</span>
                <button onClick={downloadTranscript} style={{ background: 'none', border: 'none', color: 'var(--purple)', cursor: 'pointer', fontSize: '0.75rem' }}>Download</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {transcript.map((t, i) => (
                  <div key={i}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-4)', marginBottom: 2 }}>{t.speaker} · {new Date(t.ts).toLocaleTimeString()}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', background: 'var(--bg-card)', padding: '6px 10px', borderRadius: 'var(--radius-md)' }}>{t.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat panel */}
          {chatOpen && (
            <div style={{ width: 300, background: 'var(--bg-surface)', borderLeft: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '1rem', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Chat</span>
                <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>✕</button>
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
                <div ref={chatEndRef} />
              </div>
              <div style={{ padding: '0.75rem', borderTop: '0.5px solid var(--border)', display: 'flex', gap: 8 }}>
                <input className="input-field" style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem' }}
                  placeholder="Send a message…" value={chatMsg}
                  onChange={e => setChatMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()} />
                <button className="btn btn-primary btn-sm" onClick={sendChat}>↑</button>
              </div>
            </div>
          )}
        </div>

        {/* Controls bar */}
        <div style={{
          height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '0.6rem', background: 'rgba(5,5,8,0.95)',
          borderTop: '0.5px solid var(--border)', flexShrink: 0, padding: '0 1rem',
          position: 'relative',
        }}>
          {showReactionPicker && (
            <div style={{
              position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)',
              background: 'var(--bg-surface)', border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: '10px 14px',
              display: 'flex', gap: 8, zIndex: 100,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => sendReaction(e)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', borderRadius: 8, padding: '4px 6px', transition: 'transform 0.1s' }}
                  onMouseEnter={ev => ev.currentTarget.style.transform = 'scale(1.3)'}
                  onMouseLeave={ev => ev.currentTarget.style.transform = 'scale(1)'}
                >{e}</button>
              ))}
            </div>
          )}

          <ControlBtn active={micOn}        onClick={toggleMic}       label={micOn ? '🎙️' : '🔇'} title={micOn ? 'Mute' : 'Unmute'} />
          <ControlBtn active={camOn}        onClick={toggleCam}       label={camOn ? '📷' : '🚫'} title={camOn ? 'Stop Camera' : 'Start Camera'} />
          <ControlBtn active={screenOn}     onClick={toggleScreen}    label="🖥️" title={screenOn ? 'Stop Sharing' : 'Share Screen'} />
          <ControlBtn active={chatOpen}     onClick={() => { setChatOpen(c=>!c); setParticipOpen(false) }} label="💬" title="Chat" badge={messages.length} />
          <ControlBtn active={participOpen} onClick={() => { setParticipOpen(p=>!p); setChatOpen(false) }} label="👥" title="Participants" badge={allParticipants.length} />
          <ControlBtn active={handRaised}   onClick={toggleHand}      label="✋" title={handRaised ? 'Lower Hand' : 'Raise Hand'} />
          <ControlBtn active={showReactionPicker} onClick={() => setShowReactionPicker(r=>!r)} label="😊" title="Reactions" />
          <ControlBtn active={transcribing} onClick={toggleTranscription} label="📝" title={transcribing ? 'Stop Transcription' : 'Start Transcription'} />

          <div style={{ width: 1, height: 30, background: 'var(--border)', margin: '0 0.25rem' }} />

          <button onClick={handleLeave} className="btn btn-danger" style={{ padding: '10px 20px', fontSize: '0.85rem' }}>Leave</button>
        </div>
      </div>
    </>
  )
}

function RemoteVideoTile({ name, stream, handRaised, micOn }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current && stream) ref.current.srcObject = stream }, [stream])
  return <VideoTile name={name} isLocal={false} videoRef={ref} camOn={!!stream} micOn={micOn !== false} handRaised={handRaised} />
}

function VideoTile({ name, isLocal, videoRef, camOn, micOn, handRaised, isScreen }) {
  return (
    <div style={{
      aspectRatio: '16/9', borderRadius: 'var(--radius-lg)',
      background: '#0d0d18', overflow: 'hidden', position: 'relative',
      border: handRaised ? '2px solid #facc15' : '0.5px solid var(--border)',
      transition: 'border 0.2s',
    }}>
      {camOn ? (
        <video ref={videoRef} autoPlay muted={isLocal} playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: (isLocal && !isScreen) ? 'scaleX(-1)' : 'none' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, var(--purple), var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', fontWeight: 700 }}>
            {name[0].toUpperCase()}
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>{name}</span>
        </div>
      )}
      {handRaised && (
        <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(250,204,21,0.2)', border: '1px solid #facc15', borderRadius: 100, padding: '3px 10px', fontSize: '0.75rem', color: '#facc15' }}>✋ Hand raised</div>
      )}
      <div style={{ position: 'absolute', bottom: 10, left: 10, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.6)', borderRadius: 100, padding: '3px 10px' }}>
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
        <span style={{ position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: 'var(--purple)', color: '#fff', fontSize: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>
      )}
    </button>
  )
}