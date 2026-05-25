// src/components/MeetingFeedback.jsx
import { useState, useEffect, useRef } from 'react'

const EMOJIS = [
  { icon: '😞', label: 'Poor',      value: 1, color: '#ef4444' },
  { icon: '😕', label: 'Fair',      value: 2, color: '#f97316' },
  { icon: '😐', label: 'Okay',      value: 3, color: '#eab308' },
  { icon: '😊', label: 'Good',      value: 4, color: '#84cc16' },
  { icon: '🤩', label: 'Excellent', value: 5, color: '#22c55e' },
]

const TAGS = [
  'Great audio',       'Clear video',       'Easy to use',
  'No lag',            'Good screen share', 'Smooth connection',
  'Audio issues',      'Video was blurry',  'Connection dropped',
  'Hard to navigate',  'Echo / feedback',   'Screen share failed',
]

export default function MeetingFeedback({ isOpen, onClose, onSubmit, duration, roomId }) {
  const [step,         setStep]         = useState(1)          // 1 = rating, 2 = details, 3 = done
  const [rating,       setRating]       = useState(null)
  const [hoveredRating,setHoveredRating]= useState(null)
  const [selectedTags, setSelectedTags] = useState([])
  const [comment,      setComment]      = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [mounted,      setMounted]      = useState(false)
  const overlayRef = useRef(null)

  useEffect(() => {
    if (isOpen) { setTimeout(() => setMounted(true), 10) }
    else         { setMounted(false); setTimeout(reset, 300) }
  }, [isOpen])

  const reset = () => {
    setStep(1); setRating(null); setHoveredRating(null)
    setSelectedTags([]); setComment(''); setSubmitting(false)
  }

  const toggleTag = (tag) =>
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])

  const handleSubmit = async () => {
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 900))   // simulate async save
    onSubmit?.({ rating, tags: selectedTags, comment, roomId, duration, ts: Date.now() })
    setStep(3)
    setSubmitting(false)
    setTimeout(onClose, 2400)
  }

  const fmt = (s) => {
    if (!s) return '0m'
    const m = Math.floor(s / 60), sec = s % 60
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`
  }

  const active = hoveredRating ?? rating
  const activeEmoji = EMOJIS.find(e => e.value === active)

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.25s ease',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'linear-gradient(145deg, #0f0f1a 0%, #0a0a12 100%)',
        border: '0.5px solid rgba(255,255,255,0.1)',
        borderRadius: 24,
        overflow: 'hidden',
        boxShadow: '0 40px 120px rgba(0,0,0,0.8), 0 0 0 0.5px rgba(124,58,237,0.15) inset',
        transform: mounted ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)',
        transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      }}>

        {/* Decorative top bar */}
        <div style={{
          height: 3,
          background: activeEmoji
            ? `linear-gradient(90deg, ${activeEmoji.color}88, ${activeEmoji.color})`
            : 'linear-gradient(90deg, #7c3aed88, #7c3aed)',
          transition: 'background 0.4s ease',
        }} />

        {/* Header */}
        <div style={{
          padding: '1.5rem 1.75rem 1.25rem',
          borderBottom: '0.5px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'rgba(124,58,237,0.15)',
              border: '0.5px solid rgba(124,58,237,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem',
            }}>📋</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f4f4f5', letterSpacing: '-0.01em' }}>
                Meeting Summary
              </div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                {roomId && `Room · ${roomId.slice(0,8)}…`}{duration ? `  ·  ${fmt(duration)}` : ''}
              </div>
            </div>
          </div>
          {step !== 3 && (
            <button
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'rgba(255,255,255,0.05)',
                border: '0.5px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.35)',
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
            >✕</button>
          )}
        </div>

        {/* Step indicator */}
        {step !== 3 && (
          <div style={{ padding: '0.85rem 1.75rem 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            {[1, 2].map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: s === step ? 22 : 7, height: 7,
                  borderRadius: 100,
                  background: s === step ? '#7c3aed' : s < step ? '#a78bfa' : 'rgba(255,255,255,0.1)',
                  transition: 'all 0.3s ease',
                }} />
              </div>
            ))}
            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', marginLeft: 4 }}>
              Step {step} of 2
            </span>
          </div>
        )}

        {/* ── STEP 1: Rating ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div style={{ padding: '1.5rem 1.75rem 1.75rem' }}>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#f4f4f5', marginBottom: 6, letterSpacing: '-0.01em' }}>
              How was your meeting?
            </p>
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', marginBottom: 1.75 * 16, lineHeight: 1.5 }}>
              Your feedback helps us make NexMeet better for everyone.
            </p>

            {/* Emoji rating row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: '1.5rem' }}>
              {EMOJIS.map(({ icon, label, value, color }) => {
                const isActive = active === value
                return (
                  <button
                    key={value}
                    onClick={() => setRating(value)}
                    onMouseEnter={() => setHoveredRating(value)}
                    onMouseLeave={() => setHoveredRating(null)}
                    style={{
                      flex: 1, padding: '12px 4px 10px',
                      borderRadius: 14,
                      background: isActive ? `${color}14` : 'rgba(255,255,255,0.03)',
                      border: `0.5px solid ${isActive ? color + '55' : 'rgba(255,255,255,0.07)'}`,
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 6,
                      transition: 'all 0.2s ease',
                      transform: isActive ? 'translateY(-3px) scale(1.05)' : 'translateY(0) scale(1)',
                      outline: 'none',
                    }}
                  >
                    <span style={{
                      fontSize: '1.75rem',
                      filter: isActive ? 'drop-shadow(0 0 8px ' + color + '88)' : 'none',
                      transition: 'filter 0.2s',
                      lineHeight: 1,
                    }}>{icon}</span>
                    <span style={{
                      fontSize: '0.6rem',
                      fontWeight: 600,
                      color: isActive ? color : 'rgba(255,255,255,0.25)',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      transition: 'color 0.2s',
                    }}>{label}</span>
                  </button>
                )
              })}
            </div>

            {/* Animated label */}
            <div style={{
              height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '1.5rem',
            }}>
              {activeEmoji && (
                <span style={{
                  fontSize: '0.78rem', color: activeEmoji.color,
                  fontWeight: 600, letterSpacing: '0.02em',
                  animation: 'nm-fade-in 0.2s ease',
                }}>
                  {activeEmoji.label} — {
                    activeEmoji.value === 1 ? "We're sorry to hear that." :
                    activeEmoji.value === 2 ? "We'll work on improving." :
                    activeEmoji.value === 3 ? "Thanks for your honest feedback." :
                    activeEmoji.value === 4 ? "Great to hear!" :
                    "Awesome! You made our day 🎉"
                  }
                </span>
              )}
            </div>

            <button
              onClick={() => rating && setStep(2)}
              disabled={!rating}
              style={{
                width: '100%', padding: '13px',
                borderRadius: 12, border: 'none',
                background: rating
                  ? `linear-gradient(135deg, #7c3aed, #5b21b6)`
                  : 'rgba(255,255,255,0.05)',
                color: rating ? '#fff' : 'rgba(255,255,255,0.2)',
                fontSize: '0.875rem', fontWeight: 600,
                cursor: rating ? 'pointer' : 'not-allowed',
                letterSpacing: '0.01em',
                transition: 'all 0.2s ease',
                boxShadow: rating ? '0 4px 20px rgba(124,58,237,0.35)' : 'none',
                transform: rating ? 'translateY(0)' : 'none',
              }}
              onMouseEnter={e => { if (rating) e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── STEP 2: Details ────────────────────────────────────────────── */}
        {step === 2 && (
          <div style={{ padding: '1.5rem 1.75rem 1.75rem' }}>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#f4f4f5', marginBottom: 6, letterSpacing: '-0.01em' }}>
              Tell us more
            </p>
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Select anything that applies — all fields are optional.
            </p>

            {/* Tag pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: '1.25rem' }}>
              {TAGS.map(tag => {
                const sel = selectedTags.includes(tag)
                const isPositive = !['Audio issues','Video was blurry','Connection dropped','Hard to navigate','Echo / feedback','Screen share failed'].includes(tag)
                const selColor = isPositive ? '#22c55e' : '#f87171'
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: '6px 13px',
                      borderRadius: 100,
                      border: `0.5px solid ${sel ? selColor + '55' : 'rgba(255,255,255,0.1)'}`,
                      background: sel ? `${selColor}12` : 'rgba(255,255,255,0.03)',
                      color: sel ? selColor : 'rgba(255,255,255,0.45)',
                      fontSize: '0.72rem', fontWeight: sel ? 600 : 400,
                      cursor: 'pointer', transition: 'all 0.15s',
                      letterSpacing: '0.01em',
                    }}
                  >{sel ? '✓ ' : ''}{tag}</button>
                )
              })}
            </div>

            {/* Comment box */}
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Any other thoughts? (optional)"
              maxLength={400}
              rows={3}
              style={{
                width: '100%', padding: '11px 14px',
                background: 'rgba(255,255,255,0.04)',
                border: '0.5px solid rgba(255,255,255,0.1)',
                borderRadius: 12, color: '#f4f4f5',
                fontSize: '0.82rem', lineHeight: 1.6,
                resize: 'none', outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
                marginBottom: 4,
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(124,58,237,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
            <div style={{ textAlign: 'right', fontSize: '0.62rem', color: 'rgba(255,255,255,0.2)', marginBottom: '1.25rem' }}>
              {comment.length}/400
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1, padding: '12px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: '0.5px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.45)',
                  fontSize: '0.82rem', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              >← Back</button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  flex: 2, padding: '12px',
                  borderRadius: 12, border: 'none',
                  background: submitting
                    ? 'rgba(124,58,237,0.4)'
                    : 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                  color: '#fff', fontSize: '0.875rem', fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 20px rgba(124,58,237,0.35)',
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {submitting ? (
                  <>
                    <span style={{
                      width: 14, height: 14,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTop: '2px solid #fff',
                      borderRadius: '50%',
                      animation: 'nm-spin 0.7s linear infinite',
                      display: 'inline-block',
                    }} />
                    Submitting…
                  </>
                ) : 'Submit Feedback'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Thank you ──────────────────────────────────────────── */}
        {step === 3 && (
          <div style={{
            padding: '2.5rem 1.75rem 2.5rem',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', textAlign: 'center', gap: 12,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(34,197,94,0.2) 0%, rgba(34,197,94,0.05) 70%)',
              border: '0.5px solid rgba(34,197,94,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem',
              animation: 'nm-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
            }}>✓</div>
            <div>
              <p style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f4f4f5', marginBottom: 6, letterSpacing: '-0.01em' }}>
                Thanks for your feedback!
              </p>
              <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, maxWidth: 280 }}>
                Your input helps shape the future of NexMeet. See you in the next meeting!
              </p>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 4,
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.03)',
              border: '0.5px solid rgba(255,255,255,0.07)',
              borderRadius: 100,
              fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'nm-pulse-dot 1.5s infinite' }} />
              Closing automatically…
            </div>
          </div>
        )}

        {/* Keyframes */}
        <style>{`
          @keyframes nm-fade-in  { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes nm-spin     { to   { transform: rotate(360deg); } }
          @keyframes nm-pop      { 0%  { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
          @keyframes nm-pulse-dot{ 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.7); } }
        `}</style>
      </div>
    </div>
  )
}