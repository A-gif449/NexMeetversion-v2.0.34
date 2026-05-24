// src/pages/Rooms.jsx
// Updated: shows meeting history from MeetingPersistence (Feature 1)
//          ✅ Waiting Room: saves hostUid when creating a room (Firestore)
//          ✅ Waiting Room: shows "denied" banner when redirected back
//          ✅ Typing animation added to hero header
//          ✅ FIXED: isPrivate now saved to Firestore on room creation

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../firebase/AuthContext'
import Navbar from '../components/Navbar'
import { MeetingPersistence } from '../utils/meetingPersistence'

// ✅ Firestore imports
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config'

const adjectives = ['brave','swift','cosmic','nova','solar','lunar','bright','deep','vivid','prime','sharp','clean']
const nouns      = ['orbit','nexus','pulse','wave','node','core','beam','grid','spark','link','hub','loop']
const genRoomId  = () =>
  `${adjectives[Math.random()*adjectives.length|0]}-${nouns[Math.random()*nouns.length|0]}-${Math.floor(Math.random()*900+100)}`

const PLAN_LIMITS = { free: 5, pro: 50, team: 300 }
const getRecent  = () => MeetingPersistence.getMeetingHistory()

// ── Typing animation phrases ──────────────────────────────────────────────────
const TYPING_PHRASES = [
  'start a meeting.',
  'collaborate live.',
  'host a webinar.',
  'stay connected.',
  'meet your team.',
]

function useTypingAnimation() {
  const [text, setText] = useState('')
  const state = useRef({ pi: 0, ci: 0, del: false })
  const timer = useRef(null)

  useEffect(() => {
    function tick() {
      const { pi, ci, del } = state.current
      const word = TYPING_PHRASES[pi]

      if (!del) {
        const next = ci + 1
        setText(word.slice(0, next))
        state.current.ci = next
        if (next === word.length) {
          timer.current = setTimeout(() => {
            state.current.del = true
            tick()
          }, 1600)
        } else {
          const jitter = (Math.random() - 0.5) * 16
          timer.current = setTimeout(tick, 68 + jitter)
        }
      } else {
        const next = ci - 1
        setText(word.slice(0, next))
        state.current.ci = next
        if (next === 0) {
          state.current.del = false
          state.current.pi  = (pi + 1) % TYPING_PHRASES.length
          timer.current = setTimeout(tick, 320)
        } else {
          timer.current = setTimeout(tick, 38)
        }
      }
    }
    tick()
    return () => clearTimeout(timer.current)
  }, [])

  return text
}

// ── Cursor component ──────────────────────────────────────────────────────────
function TypingCursor({ active }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 3,
      height: '0.85em',
      background: 'var(--purple)',
      borderRadius: 2,
      verticalAlign: 'middle',
      marginLeft: 3,
      position: 'relative',
      top: -1,
      animation: active ? 'none' : 'nexmeet-blink 0.9s ease-in-out infinite',
    }} />
  )
}

export default function Rooms() {
  const { user }    = useAuth()
  const navigate    = useNavigate()
  const typedText   = useTypingAnimation()
  const [isTyping, setIsTyping] = useState(true)

  // track whether cursor should blink (pause = blink, typing = solid)
  const blinkTimer = useRef(null)
  useEffect(() => {
    setIsTyping(true)
    clearTimeout(blinkTimer.current)
    blinkTimer.current = setTimeout(() => setIsTyping(false), 150)
    return () => clearTimeout(blinkTimer.current)
  }, [typedText])

  const [searchParams] = useSearchParams()
  const wasDenied = searchParams.get('denied') === 'true'

  const [tab,           setTab]         = useState('new')
  const [roomId,        setRoomId]      = useState(genRoomId())
  const [joinId,        setJoinId]      = useState('')
  const [roomName,      setRoomName]    = useState('')
  const [maxPeople,     setMaxPeople]   = useState(10)
  const [isPrivate,     setIsPrivate]   = useState(false)
  const [error,         setError]       = useState('')
  const [recentRooms,   setRecentRooms] = useState([])
  const [activeSession, setActiveSession] = useState(null)

  const plan  = 'free'
  const limit = PLAN_LIMITS[plan]

  useEffect(() => {
    setRecentRooms(getRecent())
    const session = MeetingPersistence.getSession()
    if (session) setActiveSession(session)
  }, [])

  // ✅ FIXED: isPrivate, roomName, maxPeople, createdAt now all saved to Firestore
  const handleCreate = async () => {
    if (!roomId.trim()) { setError('Room ID cannot be empty.'); return }
    setError('')
    try {
      await setDoc(doc(db, 'rooms', roomId), {
        hostUid:   user.uid,
        isPrivate: isPrivate,
        roomName:  roomName.trim() || null,
        maxPeople: maxPeople,
        createdAt: Date.now(),
      }, { merge: true })
    } catch (err) {
      console.warn('[NexMeet] Could not save room data:', err)
    }
    navigate(`/room/${roomId}`)
  }

  const handleJoin = () => {
    const id = joinId.trim()
    if (!id) { setError('Enter a room ID or link.'); return }
    const clean = id.includes('/room/') ? id.split('/room/')[1] : id
    setError('')
    navigate(`/room/${clean}`)
  }

  const handleRejoin          = () => { if (activeSession?.roomId) navigate(`/room/${activeSession.roomId}`) }
  const handleDismissSession  = () => { MeetingPersistence.clearSession(); setActiveSession(null) }

  const stats = [
    { label: 'Your plan',      value: plan.charAt(0).toUpperCase() + plan.slice(1), sub: `Up to ${limit} participants`, accent: plan === 'pro' || plan === 'team' },
    { label: 'Meetings joined',value: recentRooms.length || '—', sub: 'All time' },
    { label: 'Last meeting',   value: recentRooms[0] ? timeSince(new Date(recentRooms[0].date).getTime()) : '—', sub: recentRooms[0]?.roomId || 'No meetings yet' },
  ]

  return (
    <>
      {/* Blink keyframe injected once */}
      <style>{`
        @keyframes nexmeet-blink {
          0%, 45%  { opacity: 1; }
          55%, 100%{ opacity: 0; }
        }

        /* ── Responsive overrides ── */
        .rooms-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 2rem;
        }
        .rooms-main-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          align-items: start;
        }
        .rooms-hero-title {
          font-size: 2rem;
        }
        .rooms-typing-line {
          font-size: 1rem;
        }

        /* Tablet */
        @media (max-width: 900px) {
          .rooms-main-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Mobile */
        @media (max-width: 640px) {
          .rooms-stats-grid {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          .rooms-hero-title {
            font-size: 1.45rem !important;
          }
          .rooms-typing-line {
            font-size: 0.85rem !important;
          }
          .rooms-session-banner {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          .rooms-session-actions {
            width: 100%;
            display: flex;
            gap: 8px;
          }
          .rooms-session-actions button {
            flex: 1;
          }
        }

        /* Small mobile */
        @media (max-width: 380px) {
          .rooms-hero-title {
            font-size: 1.2rem !important;
          }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--bg-void)', paddingTop: 60, position: 'relative' }}>
        <div className="grid-bg" />
        <div className="orb orb-purple" style={{ width: 400, height: 400, top: 50, right: -100, opacity: 0.4 }} />
        <div className="orb orb-blue"   style={{ width: 250, height: 250, bottom: 100, left: -80, opacity: 0.3 }} />
        <Navbar />

        <div className="container" style={{ paddingTop: '3rem', paddingBottom: '4rem', position: 'relative', zIndex: 1 }}>

          {/* Denied banner */}
          {wasDenied && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem',
              marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: '1.1rem' }}>🚫</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#f87171' }}>You weren't admitted</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>The host did not allow you into that room.</div>
              </div>
            </div>
          )}

          {/* Interrupted session banner */}
          {activeSession && (
            <div className="rooms-session-banner" style={{
              background: 'linear-gradient(135deg, rgba(124,92,252,0.15), rgba(56,182,255,0.08))',
              border: '0.5px solid var(--border-purple)',
              borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem',
              marginBottom: '1.5rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '1.25rem' }}>🔄</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)' }}>You were in a meeting</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>
                    Room: <span style={{ fontFamily: 'monospace', color: 'var(--purple)' }}>{activeSession.roomId}</span>
                    {' · '}as {activeSession.displayName}
                    {' · '}{timeSince(activeSession.lastSeen)} ago
                  </div>
                </div>
              </div>
              <div className="rooms-session-actions" style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleRejoin}         className="btn btn-primary btn-sm">Rejoin →</button>
                <button onClick={handleDismissSession} className="btn btn-outline btn-sm">Dismiss</button>
              </div>
            </div>
          )}

          {/* ── Hero header with typing animation ── */}
          <div className="fade-up" style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span className="badge badge-purple">Rooms</span>
              {plan !== 'free' && <span className="badge badge-teal">{plan.toUpperCase()}</span>}
            </div>

            <h1 className="rooms-hero-title" style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-1)',
              marginBottom: '0.4rem', lineHeight: 1.2,
            }}>
              Good to see you, {user?.displayName?.split(' ')[0] || 'there'} 👋
            </h1>

            {/* Typing animation line */}
            <p className="rooms-typing-line" style={{
              color: 'var(--text-3)',
              display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4,
            }}>
              The easiest way to{' '}
              <span style={{
                color: 'var(--purple)',
                fontWeight: 600,
                minWidth: 160,
                display: 'inline-flex',
                alignItems: 'center',
              }}>
                {typedText}
                <TypingCursor active={isTyping} />
              </span>
            </p>
          </div>

          {/* Stats row */}
          <div className="rooms-stats-grid fade-up-1">
            {stats.map(s => (
              <div key={s.label} style={{
                background: 'var(--bg-card)', border: '0.5px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem',
              }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{s.label}</div>
                <div style={{
                  fontSize: '1.3rem', fontWeight: 700, fontFamily: 'var(--font-display)',
                  color: s.accent ? 'var(--purple)' : 'var(--text-1)',
                }}>{s.value}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-4)', marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          <div className="rooms-main-grid">

            {/* Left — create / join card */}
            <div className="card fade-up-2" style={{ padding: '1.75rem' }}>
              <div style={{
                display: 'flex', background: 'rgba(255,255,255,0.03)',
                borderRadius: 'var(--radius-md)', padding: 3, marginBottom: '1.5rem',
                border: '0.5px solid var(--border)',
              }}>
                {[['new','✦ New Meeting'],['join','↗ Join Room']].map(([t,label]) => (
                  <button key={t} onClick={() => { setTab(t); setError('') }} style={{
                    flex: 1, padding: '9px', borderRadius: 'var(--radius-sm)',
                    border: t === tab ? '0.5px solid var(--border-purple)' : 'none',
                    background: t === tab ? 'var(--purple-dim)' : 'transparent',
                    color: t === tab ? '#a78bfa' : 'var(--text-3)',
                    fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
                    fontFamily: 'var(--font-body)', transition: 'all 0.2s',
                  }}>{label}</button>
                ))}
              </div>

              {error && <div className="msg-error" style={{ marginBottom: '1rem' }}>{error}</div>}

              {tab === 'new' ? (
                <div>
                  <Field label="Room Name (optional)">
                    <input className="input-field" placeholder={`${user?.displayName || 'My'}'s Room`}
                      value={roomName} onChange={e => setRoomName(e.target.value)} />
                  </Field>

                  <Field label="Room ID">
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="input-field" style={{ flex: 1 }}
                        value={roomId} onChange={e => setRoomId(e.target.value)} />
                      <button onClick={() => setRoomId(genRoomId())} className="btn btn-outline btn-sm"
                        title="Regenerate ID" style={{ flexShrink: 0 }}>↺</button>
                    </div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-4)', marginTop: 4 }}>
                      Share this ID so others can join.
                    </p>
                  </Field>

                  <Field label={`Max Participants (your plan: ${limit})`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input type="range" min={2} max={limit} value={maxPeople}
                        onChange={e => setMaxPeople(+e.target.value)}
                        style={{ flex: 1, accentColor: 'var(--purple)' }} />
                      <span style={{ minWidth: 36, textAlign: 'center', fontWeight: 600, fontSize: '0.95rem', color: 'var(--purple)' }}>{maxPeople}</span>
                    </div>
                    {plan === 'free' && maxPeople >= 2 && (
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-4)', marginTop: 4 }}>
                        Need more?{' '}
                        <a href="/pricing" style={{ color: 'rgba(124,92,252,0.7)', textDecoration: 'none' }}>Upgrade to Pro →</a>
                      </p>
                    )}
                  </Field>

                  {/* ✅ Private Room toggle — now shows lock icon when enabled */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.1rem' }}>
                    <Toggle checked={isPrivate} onChange={setIsPrivate} />
                    <div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                        Private Room
                        {isPrivate && <span style={{ fontSize: '0.68rem', color: '#a78bfa', background: 'rgba(124,58,237,0.12)', border: '0.5px solid rgba(124,58,237,0.3)', borderRadius: 100, padding: '1px 8px' }}>🔒 On</span>}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-4)' }}>
                        {isPrivate ? 'Guests must be admitted by the host' : 'Anyone with the link can join'}
                      </div>
                    </div>
                  </div>

                  <button className="btn btn-primary btn-full" onClick={handleCreate}
                    style={{ padding: '12px', fontSize: '0.9rem', animation: 'pulse-glow 3s infinite' }}>
                    ✦ Start Meeting
                  </button>
                </div>
              ) : (
                <div>
                  <Field label="Room ID or Link">
                    <input className="input-field" placeholder="brave-orbit-492 or paste a link"
                      value={joinId} onChange={e => setJoinId(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleJoin()} />
                  </Field>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                    Paste a NexMeet room link or type the Room ID shared by the host.
                  </p>
                  <button className="btn btn-primary btn-full" onClick={handleJoin}
                    style={{ padding: '12px', fontSize: '0.9rem' }}>
                    ↗ Join Meeting
                  </button>
                </div>
              )}
            </div>

            {/* Right — recent rooms + upgrade nudge */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              <div className="card fade-up-3">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 700 }}>Recent Meetings</h3>
                  {recentRooms.length > 0 && (
                    <button onClick={() => { MeetingPersistence.clearHistory(); setRecentRooms([]) }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-4)', fontSize: '0.72rem', cursor: 'pointer' }}>
                      Clear
                    </button>
                  )}
                </div>

                {recentRooms.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-4)', fontSize: '0.82rem' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>🎙️</div>
                    Your recent meetings will appear here.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {recentRooms.map((room, i) => (
                      <div key={i} onClick={() => navigate(`/room/${room.roomId}`)} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-hover)', cursor: 'pointer',
                        border: '0.5px solid transparent', transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-purple)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                      >
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-1)', fontFamily: 'monospace' }}>{room.roomId}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-4)', marginTop: 2 }}>
                            as {room.displayName}
                            {room.duration && ` · ${Math.round(room.duration / 60000)}m`}
                          </div>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-4)' }}>
                          {timeSince(new Date(room.date).getTime())}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {plan === 'free' && (
                <div className="fade-up-4" style={{
                  background: 'linear-gradient(135deg, rgba(124,92,252,0.12) 0%, rgba(56,182,255,0.06) 100%)',
                  border: '0.5px solid var(--border-purple)',
                  borderRadius: 'var(--radius-lg)', padding: '1.25rem',
                }}>
                  <div className="badge badge-purple" style={{ marginBottom: 10 }}>PRO</div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>
                    Unlock the full experience
                  </h3>
                  <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1rem' }}>
                    {['50 participants per room','AI transcription & summaries','Cloud recording','Custom branding'].map(f => (
                      <li key={f} style={{ fontSize: '0.8rem', color: 'var(--text-2)', padding: '3px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: 'var(--teal)', fontSize: '0.7rem' }}>✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <a href="/pricing" className="btn btn-primary btn-full btn-sm" style={{ textDecoration: 'none', justifyContent: 'center' }}>
                    View Plans →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: '1.1rem' }}>
      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <div onClick={() => onChange(!checked)} style={{
      width: 40, height: 22, borderRadius: 100, cursor: 'pointer',
      background: checked ? 'var(--purple)' : 'rgba(255,255,255,0.1)',
      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      boxShadow: checked ? '0 0 10px var(--purple-glow)' : 'none',
    }}>
      <div style={{
        position: 'absolute', top: 3, left: checked ? 21 : 3,
        width: 16, height: 16, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
      }} />
    </div>
  )
}

function timeSince(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60)    return 'just now'
  if (s < 3600)  return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return `${Math.floor(s/86400)}d ago`
}