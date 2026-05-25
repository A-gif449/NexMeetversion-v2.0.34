// src/pages/Rooms.jsx — HOLOGRAPHIC 3D PARALLAX EDITION
// ✅ All logic untouched — only visual layer added
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../firebase/AuthContext'
import Navbar from '../components/Navbar'
import { MeetingPersistence } from '../utils/meetingPersistence'
import Footer from '../components/Footer'

// import { doc, setDoc } from 'firebase/firestore'
// import { db } from '../firebase/config'

const adjectives = ['brave','swift','cosmic','nova','solar','lunar','bright','deep','vivid','prime','sharp','clean']
const nouns      = ['orbit','nexus','pulse','wave','node','core','beam','grid','spark','link','hub','loop']
const genRoomId  = () =>
  `${adjectives[Math.random()*adjectives.length|0]}-${nouns[Math.random()*nouns.length|0]}-${Math.floor(Math.random()*900+100)}`

const PLAN_LIMITS = { free: 5, pro: 50, team: 300 }
const getRecent   = () => MeetingPersistence.getMeetingHistory()

const TYPING_PHRASES = ['start a meeting.','collaborate live.','host a webinar.','stay connected.','meet your team.']

function useTypingAnimation() {
  const [text, setText] = useState('')
  const state = useRef({ pi: 0, ci: 0, del: false })
  const timer = useRef(null)
  useEffect(() => {
    function tick() {
      const { pi, ci, del } = state.current
      const word = TYPING_PHRASES[pi]
      if (!del) {
        const next = ci + 1; setText(word.slice(0, next)); state.current.ci = next
        if (next === word.length) timer.current = setTimeout(() => { state.current.del = true; tick() }, 1600)
        else timer.current = setTimeout(tick, 68 + (Math.random() - 0.5) * 16)
      } else {
        const next = ci - 1; setText(word.slice(0, next)); state.current.ci = next
        if (next === 0) { state.current.del = false; state.current.pi = (pi + 1) % TYPING_PHRASES.length; timer.current = setTimeout(tick, 320) }
        else timer.current = setTimeout(tick, 38)
      }
    }
    tick()
    return () => clearTimeout(timer.current)
  }, [])
  return text
}

function TypingCursor({ active }) {
  return <span style={{ display: 'inline-block', width: 3, height: '0.85em', background: 'var(--purple)', borderRadius: 2, verticalAlign: 'middle', marginLeft: 3, position: 'relative', top: -1, animation: active ? 'none' : 'nexmeet-blink 0.9s ease-in-out infinite' }} />
}

/* ══════════════════════════════════════════════════════════════
   3D PARALLAX BACKGROUND — tracks mouse, creates depth layers
══════════════════════════════════════════════════════════════ */
function ParallaxBackground() {
  const canvasRef   = useRef(null)
  const mouseRef    = useRef({ x: 0.5, y: 0.5 })
  const targetRef   = useRef({ x: 0.5, y: 0.5 })
  const rafRef      = useRef(null)
  const particlesRef = useRef([])

  // Build particle field once
  useEffect(() => {
    const W = window.innerWidth
    const H = window.innerHeight
    particlesRef.current = Array.from({ length: 80 }, () => ({
      x:     Math.random() * W,
      y:     Math.random() * H,
      r:     Math.random() * 1.5 + 0.3,
      depth: Math.random(),           // 0 = far, 1 = near
      speed: Math.random() * 0.18 + 0.04,
      drift: (Math.random() - 0.5) * 0.3,
      pulse: Math.random() * Math.PI * 2,
      color: Math.random() > 0.6
        ? `rgba(124,58,237,${0.25 + Math.random() * 0.45})`
        : Math.random() > 0.5
          ? `rgba(59,130,246,${0.2 + Math.random() * 0.35})`
          : `rgba(20,184,166,${0.15 + Math.random() * 0.3})`,
    }))
  }, [])

  // Mouse tracking
  useEffect(() => {
    const onMove = (e) => {
      targetRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      }
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    let t = 0
    function draw() {
      const W = canvas.width
      const H = canvas.height

      // Smooth mouse lerp
      mouseRef.current.x += (targetRef.current.x - mouseRef.current.x) * 0.04
      mouseRef.current.y += (targetRef.current.y - mouseRef.current.y) * 0.04
      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      ctx.clearRect(0, 0, W, H)

      // ── Layer 1: deep void gradient ─────────────────────────
      const bg = ctx.createRadialGradient(
        mx * W, my * H, 0,
        mx * W, my * H, Math.max(W, H) * 0.85
      )
      bg.addColorStop(0,   'rgba(14,8,30,0.0)')
      bg.addColorStop(0.4, 'rgba(8,4,20,0.0)')
      bg.addColorStop(1,   'rgba(2,2,8,0.0)')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // ── Layer 2: cursor spotlight ───────────────────────────
      const spotlight = ctx.createRadialGradient(
        mx * W, my * H, 0,
        mx * W, my * H, 380
      )
      spotlight.addColorStop(0,   'rgba(124,58,237,0.07)')
      spotlight.addColorStop(0.4, 'rgba(59,130,246,0.03)')
      spotlight.addColorStop(1,   'rgba(0,0,0,0)')
      ctx.fillStyle = spotlight
      ctx.fillRect(0, 0, W, H)

      // ── Layer 3: parallax depth grid ────────────────────────
      // Far grid (slow parallax)
      drawGrid(ctx, W, H, mx, my, 0.012, 60, 'rgba(124,58,237,0.04)')
      // Near grid (faster parallax)
      drawGrid(ctx, W, H, mx, my, 0.028, 120, 'rgba(124,58,237,0.025)')

      // ── Layer 4: floating particles with depth ──────────────
      t += 0.008
      particlesRef.current.forEach(p => {
        // Parallax offset by depth
        const px = p.x + (mx - 0.5) * p.depth * -90
        const py = p.y + (my - 0.5) * p.depth * -60

        // Pulse size
        const pulse = Math.sin(t * p.speed * 8 + p.pulse) * 0.5 + 0.5
        const r = p.r * (0.7 + pulse * 0.6) * (0.4 + p.depth * 0.6)

        // Glow halo for near particles
        if (p.depth > 0.6) {
          const glow = ctx.createRadialGradient(px, py, 0, px, py, r * 5)
          glow.addColorStop(0, p.color.replace(/[\d.]+\)$/, '0.15)'))
          glow.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(px, py, r * 5, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(px, py, r, 0, Math.PI * 2)
        ctx.fill()

        // Drift slowly upward
        p.y -= p.speed * 0.15
        p.x += p.drift * 0.05
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W }
        if (p.x < -10) p.x = W + 10
        if (p.x > W + 10) p.x = -10
      })

      // ── Layer 5: depth fog rings from cursor ────────────────
      const now = Date.now() * 0.001
      for (let i = 0; i < 3; i++) {
        const phase = (now * 0.18 + i * 1.1) % 1
        const ringR = phase * 320
        const alpha = (1 - phase) * 0.045
        const ring = ctx.createRadialGradient(mx*W, my*H, ringR*0.8, mx*W, my*H, ringR)
        ring.addColorStop(0, `rgba(124,58,237,0)`)
        ring.addColorStop(0.7, `rgba(124,58,237,${alpha})`)
        ring.addColorStop(1, `rgba(59,130,246,0)`)
        ctx.strokeStyle = ring
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(mx * W, my * H, ringR, 0, Math.PI * 2)
        ctx.stroke()
      }

// ── Layer 6: corner accent glows ───────────────────────
      drawCornerGlow(ctx, 0,   0,   mx, my, 'rgba(124,58,237,0.12)')
      drawCornerGlow(ctx, W,   H,   mx, my, 'rgba(59,130,246,0.08)')
      drawCornerGlow(ctx, W,   0,   mx, my, 'rgba(20,184,166,0.06)')
      drawCornerGlow(ctx, 0,   H,   mx, my, 'rgba(124,58,237,0.06)')

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    // ── Pause animation when tab is hidden (saves GPU + CPU) ──
    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current)
      } else {
        rafRef.current = requestAnimationFrame(draw)
      }
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}

function drawGrid(ctx, W, H, mx, my, parallaxFactor, cellSize, color) {
  const ox = (mx - 0.5) * W * parallaxFactor
  const oy = (my - 0.5) * H * parallaxFactor
  ctx.strokeStyle = color
  ctx.lineWidth   = 0.5
  ctx.beginPath()
  const startX = ((- ox) % cellSize + cellSize) % cellSize - cellSize
  const startY = ((- oy) % cellSize + cellSize) % cellSize - cellSize
  for (let x = startX; x < W + cellSize; x += cellSize) {
    ctx.moveTo(x, 0); ctx.lineTo(x, H)
  }
  for (let y = startY; y < H + cellSize; y += cellSize) {
    ctx.moveTo(0, y); ctx.lineTo(W, y)
  }
  ctx.stroke()
}

function drawCornerGlow(ctx, cx, cy, mx, my, color) {
  const dist   = Math.hypot(mx * ctx.canvas.width - cx, my * ctx.canvas.height - cy)
  const maxD   = Math.hypot(ctx.canvas.width, ctx.canvas.height)
  const factor = 1 - Math.min(dist / (maxD * 0.6), 1)
  if (factor < 0.01) return
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 300 * factor)
  grad.addColorStop(0, color)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
}

/* ── Magnetic card — 3D tilt on hover ─────────────────────── */
function MagneticCard({ children, style, className, intensity = 8 }) {
  const ref = useRef(null)

  const onMove = useCallback((e) => {
    const el   = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx   = rect.left + rect.width  / 2
    const cy   = rect.top  + rect.height / 2
    const dx   = (e.clientX - cx) / (rect.width  / 2)
    const dy   = (e.clientY - cy) / (rect.height / 2)
    el.style.transform = `perspective(800px) rotateY(${dx * intensity}deg) rotateX(${-dy * intensity}deg) translateZ(6px)`
    el.style.boxShadow = `${-dx * 12}px ${-dy * 12}px 40px rgba(124,58,237,0.18), 0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)`
  }, [intensity])

  const onLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.transform  = 'perspective(800px) rotateY(0deg) rotateX(0deg) translateZ(0)'
    el.style.boxShadow  = ''
    el.style.transition = 'transform 0.6s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.6s ease'
  }, [])

  const onEnter = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.transition = 'transform 0.1s ease, box-shadow 0.1s ease'
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onMouseEnter={onEnter}
      style={{ transformStyle: 'preserve-3d', willChange: 'transform', ...style }}
    >
      {children}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function Rooms() {
  const { user }  = useAuth()
  const navigate  = useNavigate()
  const typedText = useTypingAnimation()
  const [isTyping, setIsTyping] = useState(true)
  const blinkTimer = useRef(null)
  useEffect(() => {
    setIsTyping(true); clearTimeout(blinkTimer.current)
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
  const [isPrivate,     setIsPrivate]   = useState(true)
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

  const handleCreate = async () => {
    const { db } = await import('../firebase/config')
    const { doc, setDoc } = await import('firebase/firestore')
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
    setError(''); navigate(`/room/${clean}`)
  }

  const handleRejoin         = () => { if (activeSession?.roomId) navigate(`/room/${activeSession.roomId}`) }
  const handleDismissSession = () => { MeetingPersistence.clearSession(); setActiveSession(null) }

  const stats = [
    { label: 'Your plan',       value: plan.charAt(0).toUpperCase() + plan.slice(1), sub: `Up to ${limit} participants`, accent: plan === 'pro' || plan === 'team' },
    { label: 'Meetings joined', value: recentRooms.length || '—', sub: 'All time' },
    { label: 'Last meeting',    value: recentRooms[0] ? timeSince(new Date(recentRooms[0].date).getTime()) : '—', sub: recentRooms[0]?.roomId || 'No meetings yet' },
  ]

  return (
    <>
      <style>{`
        @keyframes nexmeet-blink { 0%, 45% { opacity: 1; } 55%, 100% { opacity: 0; } }
        @keyframes slideDown  { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeUp     { from { opacity:0; transform:translateY(20px);  } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse-glow { 0%,100% { box-shadow:0 0 20px rgba(124,58,237,0.35),0 0 40px rgba(124,58,237,0.1); } 50% { box-shadow:0 0 35px rgba(124,58,237,0.6),0 0 70px rgba(124,58,237,0.2); } }
        @keyframes shimmer    { 0% { background-position:-200% 0; } 100% { background-position:200% 0; } }
        @keyframes borderPulse { 0%,100% { border-color:rgba(124,58,237,0.25); } 50% { border-color:rgba(167,139,250,0.55); } }

        .rooms-stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 2.2rem; }
        .rooms-main-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 1.75rem; align-items: start; }
        .rooms-hero-title { font-size: 2.1rem; }
        .rooms-typing-line { font-size: 1rem; }

        .holo-stat-card {
          background: rgba(10,6,24,0.7);
          border: 0.5px solid rgba(124,58,237,0.2);
          border-radius: 14px;
          padding: 1.1rem 1.35rem;
          backdrop-filter: blur(20px);
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
          animation: fadeUp 0.5s ease both;
          cursor: default;
        }
        .holo-stat-card:hover {
          border-color: rgba(167,139,250,0.45);
          box-shadow: 0 0 30px rgba(124,58,237,0.12), inset 0 1px 0 rgba(255,255,255,0.04);
        }

        .holo-main-card {
          background: rgba(8,5,20,0.75);
          border: 0.5px solid rgba(124,58,237,0.22);
          border-radius: 18px;
          padding: 1.85rem;
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
        }

        .holo-side-card {
          background: rgba(8,5,20,0.72);
          border: 0.5px solid rgba(124,58,237,0.2);
          border-radius: 18px;
          padding: 1.35rem;
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
        }

        .holo-tab-btn {
          flex: 1; padding: 9px; border-radius: 10px; font-size: 0.82rem;
          font-weight: 500; cursor: pointer; font-family: var(--font-body);
          transition: all 0.22s ease;
        }
        .holo-tab-btn.active {
          border: 0.5px solid rgba(124,58,237,0.45);
          background: rgba(124,58,237,0.14);
          color: #c4b5fd;
          box-shadow: 0 0 14px rgba(124,58,237,0.15);
        }
        .holo-tab-btn.inactive {
          border: none;
          background: transparent;
          color: rgba(167,139,250,0.4);
        }
        .holo-tab-btn.inactive:hover {
          color: rgba(167,139,250,0.7);
          background: rgba(124,58,237,0.06);
        }

        .holo-input {
          width: 100%;
          padding: 10px 14px;
          font-size: 0.875rem;
          background: rgba(124,58,237,0.05);
          border: 0.5px solid rgba(124,58,237,0.2);
          border-radius: 10px;
          color: #e4e4f7;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          font-family: var(--font-body);
        }
        .holo-input:focus {
          border-color: rgba(124,58,237,0.55);
          box-shadow: 0 0 0 3px rgba(124,58,237,0.1), 0 0 16px rgba(124,58,237,0.08);
        }
        .holo-input::placeholder { color: rgba(167,139,250,0.3); }

        .holo-recent-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 12px; border-radius: 10px;
          background: rgba(124,58,237,0.04);
          cursor: pointer;
          border: 0.5px solid rgba(124,58,237,0.1);
          transition: all 0.2s ease;
        }
        .holo-recent-item:hover {
          background: rgba(124,58,237,0.1);
          border-color: rgba(167,139,250,0.35);
          transform: translateX(3px);
        }

        .holo-start-btn {
          width: 100%; padding: 13px; font-size: 0.9rem;
          background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%);
          border: none; border-radius: 12px; color: #fff;
          font-weight: 600; cursor: pointer; font-family: var(--font-body);
          letter-spacing: 0.02em;
          animation: pulse-glow 3s infinite;
          transition: transform 0.2s, filter 0.2s;
          position: relative; overflow: hidden;
        }
        .holo-start-btn::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          background-size: 200% 100%;
          animation: shimmer 2.5s infinite;
        }
        .holo-start-btn:hover { transform: translateY(-2px); filter: brightness(1.12); }
        .holo-start-btn:active { transform: translateY(0); filter: brightness(0.95); }

        .holo-join-btn {
          width: 100%; padding: 13px; font-size: 0.9rem;
          background: rgba(124,58,237,0.12);
          border: 0.5px solid rgba(124,58,237,0.4); border-radius: 12px; color: #c4b5fd;
          font-weight: 600; cursor: pointer; font-family: var(--font-body);
          letter-spacing: 0.02em;
          transition: all 0.2s ease;
        }
        .holo-join-btn:hover {
          background: rgba(124,58,237,0.2);
          border-color: rgba(167,139,250,0.6);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(124,58,237,0.2);
        }

        .holo-regen-btn {
          flex-shrink: 0;
          background: rgba(124,58,237,0.08);
          border: 0.5px solid rgba(124,58,237,0.25);
          border-radius: 8px; padding: 8px 12px;
          color: rgba(167,139,250,0.7); cursor: pointer; font-size: 0.9rem;
          transition: all 0.2s;
        }
        .holo-regen-btn:hover {
          background: rgba(124,58,237,0.16);
          border-color: rgba(167,139,250,0.5);
          color: #c4b5fd;
          transform: rotate(180deg);
        }

        .denied-banner {
          background: rgba(239,68,68,0.07);
          border: 0.5px solid rgba(239,68,68,0.25);
          border-radius: 14px; padding: 1rem 1.25rem; margin-bottom: 1.5rem;
          display: flex; align-items: center; gap: 12px;
          backdrop-filter: blur(12px);
          animation: slideDown 0.3s ease;
        }

        .session-banner {
          background: linear-gradient(135deg, rgba(124,58,237,0.1), rgba(59,130,246,0.06));
          border: 0.5px solid rgba(124,58,237,0.28);
          border-radius: 14px; padding: 1rem 1.25rem; margin-bottom: 1.5rem;
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          backdrop-filter: blur(12px);
          animation: slideDown 0.3s ease;
        }

        @media (max-width: 900px) { .rooms-main-grid { grid-template-columns: 1fr; } }
        @media (max-width: 640px) {
          .rooms-stats-grid { grid-template-columns: 1fr; gap: 8px; }
          .rooms-hero-title { font-size: 1.5rem !important; }
          .rooms-typing-line { font-size: 0.85rem !important; }
          .session-banner { flex-direction: column !important; align-items: flex-start !important; }
          .rooms-session-actions { width: 100%; display: flex; gap: 8px; }
          .rooms-session-actions button { flex: 1; }
        }
        @media (max-width: 380px) { .rooms-hero-title { font-size: 1.2rem !important; } }
      `}</style>

      {/* ══ 3D PARALLAX CANVAS ══════════════════════════════════ */}
      <ParallaxBackground />

      <div style={{ minHeight: '100vh', background: 'transparent', paddingTop: 60, position: 'relative' }}>
        {/* keep original grid-bg but dimmer since canvas handles it */}
        {/* <div className="grid-bg" style={{ opacity: 0.3 }} /> */}
        <Navbar />

        <div className="container" style={{ paddingTop: '3rem', paddingBottom: '4rem', position: 'relative', zIndex: 1 }}>

          {/* ── Denied banner ─────────────────────────────────── */}
          {wasDenied && (
            <div className="denied-banner">
              <span style={{ fontSize: '1.1rem' }}>🚫</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#f87171' }}>You weren't admitted</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>The host did not allow you into that room.</div>
              </div>
            </div>
          )}

          {/* ── Rejoin session banner ──────────────────────────── */}
          {activeSession && (
            <div className="session-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '1.25rem' }}>🔄</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#e4e4f7' }}>You were in a meeting</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>
                    Room: <span style={{ fontFamily: 'monospace', color: '#a78bfa' }}>{activeSession.roomId}</span> · as {activeSession.displayName} · {timeSince(activeSession.lastSeen)} ago
                  </div>
                </div>
              </div>
              <div className="rooms-session-actions" style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleRejoin}         className="btn btn-primary btn-sm">Rejoin →</button>
                <button onClick={handleDismissSession} className="btn btn-outline btn-sm">Dismiss</button>
              </div>
            </div>
          )}

          {/* ── Hero ──────────────────────────────────────────── */}
          <div className="fade-up" style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span style={{ fontSize: '0.68rem', color: '#a78bfa', background: 'rgba(124,58,237,0.12)', border: '0.5px solid rgba(124,58,237,0.3)', padding: '3px 12px', borderRadius: 100, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>Rooms</span>
              {plan !== 'free' && <span style={{ fontSize: '0.68rem', color: '#2dd4bf', background: 'rgba(20,184,166,0.1)', border: '0.5px solid rgba(20,184,166,0.25)', padding: '3px 12px', borderRadius: 100, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{plan.toUpperCase()}</span>}
            </div>
            <h1 className="rooms-hero-title" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.025em', color: '#f0efff', marginBottom: '0.5rem', lineHeight: 1.15 }}>
              Good to see you, {user?.displayName?.split(' ')[0] || 'there'} 👋
            </h1>
            <p className="rooms-typing-line" style={{ color: 'rgba(167,139,250,0.55)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5 }}>
              The easiest way to{' '}
              <span style={{ color: '#a78bfa', fontWeight: 600, minWidth: 165, display: 'inline-flex', alignItems: 'center' }}>
                {typedText}<TypingCursor active={isTyping} />
              </span>
            </p>
          </div>

          {/* ── Stats row ─────────────────────────────────────── */}
          <div className="rooms-stats-grid">
            {stats.map((s, i) => (
              <MagneticCard key={s.label} intensity={6}
                className="holo-stat-card"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div style={{ fontSize: '0.68rem', color: 'rgba(167,139,250,0.45)', marginBottom: 5, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', color: s.accent ? '#a78bfa' : '#f0efff', textShadow: s.accent ? '0 0 20px rgba(124,58,237,0.4)' : 'none' }}>{s.value}</div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(167,139,250,0.3)', marginTop: 3, fontFamily: 'monospace' }}>{s.sub}</div>
              </MagneticCard>
            ))}
          </div>

          {/* ── Main grid ─────────────────────────────────────── */}
          <div className="rooms-main-grid">

            {/* Left: create / join card */}
            <MagneticCard intensity={4} className="holo-main-card fade-up-2">
              {/* Tab switcher */}
              <div style={{ display: 'flex', background: 'rgba(124,58,237,0.06)', borderRadius: 12, padding: 3, marginBottom: '1.6rem', border: '0.5px solid rgba(124,58,237,0.15)' }}>
                {[['new','✦ New Meeting'],['join','↗ Join Room']].map(([t, label]) => (
                  <button key={t} onClick={() => { setTab(t); setError('') }}
                    className={`holo-tab-btn ${t === tab ? 'active' : 'inactive'}`}
                  >{label}</button>
                ))}
              </div>

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: '1rem', fontSize: '0.82rem', color: '#f87171', animation: 'slideDown 0.2s ease' }}>{error}</div>
              )}

              {tab === 'new' ? (
                <div>
                  <HoloField label="Room Name (optional)">
                    <input className="holo-input" placeholder={`${user?.displayName || 'My'}'s Room`} value={roomName} onChange={e => setRoomName(e.target.value)} />
                  </HoloField>

                  <HoloField label="Room ID">
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="holo-input" style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.82rem', letterSpacing: '0.04em' }} value={roomId} onChange={e => setRoomId(e.target.value)} />
                      <button onClick={() => setRoomId(genRoomId())} className="holo-regen-btn" title="Regenerate">↺</button>
                    </div>
                    <p style={{ fontSize: '0.68rem', color: 'rgba(167,139,250,0.3)', marginTop: 5, letterSpacing: '0.01em' }}>Share this ID so others can join.</p>
                  </HoloField>

                  <HoloField label={`Max Participants (your plan: ${limit})`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input type="range" min={2} max={limit} value={maxPeople} onChange={e => setMaxPeople(+e.target.value)}
                        style={{ flex: 1, accentColor: '#7c3aed', height: 4 }} />
                      <span style={{ minWidth: 36, textAlign: 'center', fontWeight: 700, fontSize: '1rem', color: '#a78bfa', textShadow: '0 0 12px rgba(124,58,237,0.5)', fontFamily: 'monospace' }}>{maxPeople}</span>
                    </div>
                  </HoloField>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.4rem', padding: '12px 14px', borderRadius: 12, background: 'rgba(124,58,237,0.05)', border: '0.5px solid rgba(124,58,237,0.14)' }}>
                    <Toggle checked={isPrivate} onChange={setIsPrivate} />
                    <div>
                      <div style={{ fontSize: '0.82rem', color: '#c4b5fd', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 7 }}>
                        Private Room
                        <span style={{ fontSize: '0.62rem', color: isPrivate ? '#a78bfa' : 'rgba(167,139,250,0.35)', background: isPrivate ? 'rgba(124,58,237,0.14)' : 'rgba(255,255,255,0.03)', border: `0.5px solid ${isPrivate ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 100, padding: '1px 9px' }}>
                          {isPrivate ? '🔒 On' : 'Off'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(167,139,250,0.35)', marginTop: 2 }}>
                        {isPrivate ? 'Guests must be admitted by the host' : 'Anyone with the link can join instantly'}
                      </div>
                    </div>
                  </div>

                  <button className="holo-start-btn" onClick={handleCreate}>✦ Start Meeting</button>
                </div>
              ) : (
                <div>
                  <HoloField label="Room ID or Link">
                    <input className="holo-input" placeholder="brave-orbit-492 or paste a link" value={joinId}
                      onChange={e => setJoinId(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleJoin()} />
                  </HoloField>
                  <p style={{ fontSize: '0.78rem', color: 'rgba(167,139,250,0.4)', marginBottom: '1.4rem', lineHeight: 1.6 }}>
                    Paste a NexMeet room link or type the Room ID shared by the host.
                  </p>
                  <button className="holo-join-btn" onClick={handleJoin}>↗ Join Meeting</button>
                </div>
              )}
            </MagneticCard>

            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Recent meetings */}
              <MagneticCard intensity={3} className="holo-side-card fade-up-3">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: '#c4b5fd', letterSpacing: '-0.01em' }}>Recent Meetings</h3>
                  {recentRooms.length > 0 && (
                    <button onClick={() => { MeetingPersistence.clearHistory(); setRecentRooms([]) }}
                      style={{ background: 'none', border: 'none', color: 'rgba(167,139,250,0.3)', fontSize: '0.72rem', cursor: 'pointer', transition: 'color 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(167,139,250,0.3)'}
                    >Clear</button>
                  )}
                </div>
                {recentRooms.length === 0
                  ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'rgba(167,139,250,0.25)', fontSize: '0.8rem' }}>
                      <div style={{ fontSize: '1.6rem', marginBottom: 8, filter: 'grayscale(0.3)' }}>🎙️</div>
                      Your recent meetings will appear here.
                    </div>
                  )
                  : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {recentRooms.map((room, i) => (
                        <div key={i} className="holo-recent-item" onClick={() => navigate(`/room/${room.roomId}`)}>
                          <div>
                            <div style={{ fontSize: '0.83rem', fontWeight: 500, color: '#e4e4f7', fontFamily: 'monospace', letterSpacing: '0.02em' }}>{room.roomId}</div>
                            <div style={{ fontSize: '0.7rem', color: 'rgba(167,139,250,0.35)', marginTop: 2 }}>as {room.displayName}{room.duration && ` · ${Math.round(room.duration / 60000)}m`}</div>
                          </div>
                          <span style={{ fontSize: '0.68rem', color: 'rgba(167,139,250,0.3)', flexShrink: 0 }}>{timeSince(new Date(room.date).getTime())}</span>
                        </div>
                      ))}
                    </div>
                  )
                }
              </MagneticCard>

              {/* Pro upgrade card */}
              {plan === 'free' && (
                <MagneticCard intensity={5} className="fade-up-4"
                  style={{
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(59,130,246,0.06) 100%)',
                    border: '0.5px solid rgba(124,58,237,0.28)',
                    borderRadius: 18, padding: '1.4rem',
                    backdropFilter: 'blur(24px)',
                    animation: 'fadeUp 0.5s 0.4s ease both, borderPulse 4s 1s ease-in-out infinite',
                  }}
                >
                  <div style={{ fontSize: '0.62rem', color: '#a78bfa', background: 'rgba(124,58,237,0.15)', border: '0.5px solid rgba(124,58,237,0.3)', padding: '3px 12px', borderRadius: 100, display: 'inline-block', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 12 }}>PRO</div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, marginBottom: 8, color: '#f0efff', letterSpacing: '-0.01em' }}>Unlock the full experience</h3>
                  <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1.1rem' }}>
                    {['50 participants per room','AI transcription & summaries','Cloud recording','Custom branding'].map(f => (
                      <li key={f} style={{ fontSize: '0.78rem', color: 'rgba(228,228,247,0.65)', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span style={{ color: '#2dd4bf', fontSize: '0.65rem', fontWeight: 700, textShadow: '0 0 8px rgba(20,184,166,0.5)' }}>✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <a href="/pricing" style={{
                    display: 'block', width: '100%', padding: '11px', textAlign: 'center',
                    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                    border: 'none', borderRadius: 12, color: '#fff',
                    fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                    textDecoration: 'none',
                    boxShadow: '0 4px 20px rgba(124,58,237,0.3)',
                    transition: 'all 0.2s ease',
                    letterSpacing: '0.02em',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 28px rgba(124,58,237,0.45)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 4px 20px rgba(124,58,237,0.3)' }}
                  >View Plans →</a>
                </MagneticCard>
              )}
            </div>
          </div>
        </div>
        <Footer/>
      </div>
    </>
  )
}

/* ── Sub-components (all logic untouched) ─────────────────── */
function HoloField({ label, children }) {
  return (
    <div style={{ marginBottom: '1.15rem' }}>
      <label style={{ display: 'block', fontSize: '0.67rem', color: 'rgba(167,139,250,0.45)', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <div onClick={() => onChange(!checked)} style={{ width: 42, height: 23, borderRadius: 100, cursor: 'pointer', background: checked ? '#7c3aed' : 'rgba(255,255,255,0.08)', position: 'relative', transition: 'background 0.25s', flexShrink: 0, boxShadow: checked ? '0 0 14px rgba(124,58,237,0.5)' : 'none', border: `0.5px solid ${checked ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.1)'}` }}>
      <div style={{ position: 'absolute', top: 3, left: checked ? 22 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.25s cubic-bezier(0.34,1.56,0.64,1)', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
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