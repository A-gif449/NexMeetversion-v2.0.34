// src/pages/Rooms.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../firebase/AuthContext'
import Navbar from '../components/Navbar'

// Generates a readable room ID like "brave-orbit-492"
const adjectives = ['brave','swift','cosmic','nova','solar','lunar','bright','deep','vivid','prime','sharp','clean']
const nouns      = ['orbit','nexus','pulse','wave','node','core','beam','grid','spark','link','hub','loop']
const genRoomId  = () =>
  `${adjectives[Math.random()*adjectives.length|0]}-${nouns[Math.random()*nouns.length|0]}-${Math.floor(Math.random()*900+100)}`

const PLAN_LIMITS = { free: 5, pro: 50, team: 300 }

const RECENT_KEY = 'nexmeet_recent_rooms'
const getRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || [] } catch { return [] } }
const saveRecent = (room) => {
  const rooms = [room, ...getRecent().filter(r => r.id !== room.id)].slice(0, 5)
  localStorage.setItem(RECENT_KEY, JSON.stringify(rooms))
}

export default function Rooms() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [tab,        setTab]        = useState('new')   // 'new' | 'join'
  const [roomId,     setRoomId]     = useState(genRoomId())
  const [joinId,     setJoinId]     = useState('')
  const [roomName,   setRoomName]   = useState('')
  const [maxPeople,  setMaxPeople]  = useState(10)
  const [isPrivate,  setIsPrivate]  = useState(false)
  const [error,      setError]      = useState('')
  const [recentRooms,setRecentRooms]= useState([])

  // Mock user plan — replace with Firestore lookup
  const plan = 'free'
  const limit = PLAN_LIMITS[plan]

  useEffect(() => { setRecentRooms(getRecent()) }, [])

  const handleCreate = () => {
    if (!roomId.trim()) { setError('Room ID cannot be empty.'); return }
    setError('')
    const room = {
      id: roomId,
      name: roomName || `${user.displayName || 'My'}'s Room`,
      host: user.displayName || user.email,
      created: Date.now(),
    }
    saveRecent(room)
    navigate(`/room/${roomId}`)
  }

  const handleJoin = () => {
    const id = joinId.trim()
    if (!id) { setError('Enter a room ID or link.'); return }
    const clean = id.includes('/room/') ? id.split('/room/')[1] : id
    setError('')
    navigate(`/room/${clean}`)
  }

  const stats = [
    { label: 'Your plan', value: plan.charAt(0).toUpperCase() + plan.slice(1), sub: `Up to ${limit} participants`, accent: plan === 'pro' || plan === 'team' },
    { label: 'Rooms hosted', value: '—', sub: 'All time' },
    { label: 'Minutes saved', value: '—', sub: 'With AI notes' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', paddingTop: 60, position: 'relative' }}>
      <div className="grid-bg" />
      <div className="orb orb-purple" style={{ width: 400, height: 400, top: 50, right: -100, opacity: 0.4 }} />
      <div className="orb orb-blue"   style={{ width: 250, height: 250, bottom: 100, left: -80, opacity: 0.3 }} />
      <Navbar />

      <div className="container" style={{ paddingTop: '3rem', paddingBottom: '4rem', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div className="fade-up" style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span className="badge badge-purple">Rooms</span>
            {plan !== 'free' && <span className="badge badge-teal">{plan.toUpperCase()}</span>}
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: '2rem',
            fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-1)',
            marginBottom: '0.4rem',
          }}>
            Good to see you, {user?.displayName?.split(' ')[0] || 'there'} 👋
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>
            Start a new meeting or hop into an existing room.
          </p>
        </div>

        {/* Stats row */}
        <div className="fade-up-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: '2rem' }}>
          {stats.map(s => (
            <div key={s.label} style={{
              background: 'var(--bg-card)', border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem',
            }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{
                fontSize: '1.3rem', fontWeight: 700,
                fontFamily: 'var(--font-display)',
                color: s.accent ? 'var(--purple)' : 'var(--text-1)',
              }}>{s.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-4)', marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

          {/* Left — create / join card */}
          <div className="card fade-up-2" style={{ padding: '1.75rem' }}>
            {/* Tabs */}
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
                    <span style={{
                      minWidth: 36, textAlign: 'center', fontWeight: 600,
                      fontSize: '0.95rem', color: 'var(--purple)',
                    }}>{maxPeople}</span>
                  </div>
                  {plan === 'free' && maxPeople >= 2 && (
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-4)', marginTop: 4 }}>
                      Need more?{' '}
                      <a href="/pricing" style={{ color: 'rgba(124,92,252,0.7)', textDecoration: 'none' }}>Upgrade to Pro →</a>
                    </p>
                  )}
                </Field>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
                  <Toggle checked={isPrivate} onChange={setIsPrivate} />
                  <div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', fontWeight: 500 }}>Private Room</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-4)' }}>Require invite link to join</div>
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

            {/* Recent rooms */}
            <div className="card fade-up-3">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 700 }}>Recent Rooms</h3>
                {recentRooms.length > 0 && (
                  <button onClick={() => { localStorage.removeItem(RECENT_KEY); setRecentRooms([]) }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-4)', fontSize: '0.72rem', cursor: 'pointer' }}>
                    Clear
                  </button>
                )}
              </div>

              {recentRooms.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '2rem',
                  color: 'var(--text-4)', fontSize: '0.82rem',
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>🎙️</div>
                  Your recent rooms will appear here.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recentRooms.map(room => (
                    <div key={room.id} onClick={() => navigate(`/room/${room.id}`)} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-hover)', cursor: 'pointer',
                      border: '0.5px solid transparent',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-purple)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-1)' }}>{room.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-4)', marginTop: 2 }}>{room.id}</div>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-4)' }}>
                        {timeSince(room.created)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upgrade nudge for free plan */}
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
  )
}

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
  if (s < 60)   return 'just now'
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return `${Math.floor(s/86400)}d ago`
}