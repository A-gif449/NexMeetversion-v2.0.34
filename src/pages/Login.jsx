// src/pages/Login.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  signInEmail, signUpEmail, signInGoogle, resetPassword
} from '../firebase/config'
import { useAuth } from '../firebase/AuthContext'

export default function Login() {
  const [searchParams] = useSearchParams()
  const [tab,      setTab]      = useState(searchParams.get('tab') === 'signup' ? 'signup' : 'login')
  const [view,     setView]     = useState('main') // 'main' | 'forgot'
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')
  const [loading,  setLoading]  = useState(false)

  const { user } = useAuth()
  const navigate  = useNavigate()

  useEffect(() => { if (user) navigate('/rooms', { replace: true }) }, [user])

  const clearMessages = () => { setError(''); setSuccess('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    clearMessages(); setLoading(true)
    try {
      if (tab === 'signup') {
        if (!name.trim())           throw new Error('Display name is required.')
        if (password !== confirm)   throw new Error('Passwords do not match.')
        if (password.length < 6)    throw new Error('Password must be at least 6 characters.')
        await signUpEmail(email, password, name.trim())
      } else {
        await signInEmail(email, password)
      }
      navigate('/rooms')
    } catch (err) {
      setError(friendlyError(err.code || err.message))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    clearMessages(); setLoading(true)
    try {
      await signInGoogle()
      navigate('/rooms')
    } catch (err) {
      setError(friendlyError(err.code || err.message))
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    clearMessages(); setLoading(true)
    try {
      await resetPassword(email)
      setSuccess('Reset link sent! Check your inbox.')
    } catch (err) {
      setError(friendlyError(err.code || err.message))
    } finally {
      setLoading(false)
    }
  }

  const switchTab = (t) => { setTab(t); clearMessages() }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: 'var(--bg-void)', overflow: 'hidden', position: 'relative',
    }}>
      {/* Background grid */}
      <div className="grid-bg" />

      {/* Orbs */}
      <div className="orb orb-purple" style={{ width: 500, height: 500, top: -150, left: -100, opacity: 0.6 }} />
      <div className="orb orb-blue"   style={{ width: 350, height: 350, bottom: -80, right: -80 }} />
      <div className="orb orb-teal"   style={{ width: 200, height: 200, top: '40%', left: '40%' }} />

      {/* Left panel */}
      <div style={{
        width: '45%', position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: '3rem', overflow: 'hidden',
      }}>
        {/* Subtle inner gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(124,92,252,0.08) 0%, transparent 60%)',
          borderRight: '0.5px solid var(--border)',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }} className="fade-up">
          {/* Logo */}
          <Link to="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontFamily: 'var(--font-display)', fontWeight: 800,
            fontSize: '1.4rem', color: 'var(--text-1)', textDecoration: 'none',
            marginBottom: '3rem',
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: 'var(--purple)', display: 'block',
              boxShadow: '0 0 14px var(--purple-glow)',
            }} />
            NexMeet
          </Link>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: '2.5rem',
            fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.03em',
            color: 'var(--text-1)', marginBottom: '1rem',
          }}>
            Meet without<br />
            <span style={{
              background: 'linear-gradient(90deg, var(--purple), var(--blue))',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>limits.</span>
          </h1>

          <p style={{ fontSize: '0.9rem', color: 'var(--text-3)', lineHeight: 1.7, maxWidth: 280, marginBottom: '2rem' }}>
            Secure, crystal-clear video meetings. Built for teams that move fast.
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['🔒 E2E Encrypted', '⚡ AI Transcription', '🎥 4K Video', '🌐 Global CDN'].map(f => (
              <span key={f} style={{
                fontSize: '0.72rem', padding: '4px 12px', borderRadius: 100,
                border: '0.5px solid var(--border-purple)',
                color: 'rgba(255,255,255,0.45)',
                background: 'var(--purple-dim)',
              }}>{f}</span>
            ))}
          </div>

          {/* Testimonial */}
          <div style={{
            marginTop: '2.5rem', padding: '1rem 1.25rem',
            background: 'rgba(255,255,255,0.03)',
            border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            maxWidth: 300,
          }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', fontStyle: 'italic', lineHeight: 1.6, marginBottom: 8 }}>
              "NexMeet cut our meeting drop-offs by 60%. The quality is unreal."
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--purple), var(--teal))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 700, color: '#fff',
              }}>S</div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-1)' }}>Sneha R.</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>CTO, Buildstack</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{
        width: '55%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem', position: 'relative', zIndex: 1,
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          {view === 'forgot' ? (
            /* ── Forgot password ── */
            <div className="fade-up">
              <button onClick={() => { setView('main'); clearMessages() }} style={{
                background: 'none', border: 'none', color: 'var(--text-3)',
                fontSize: '0.82rem', cursor: 'pointer', marginBottom: '1.5rem',
                display: 'flex', alignItems: 'center', gap: 6, padding: 0,
              }}>← Back to sign in</button>

              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                Reset password
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-3)', marginBottom: '1.5rem' }}>
                Enter your email and we'll send a reset link.
              </p>

              <form onSubmit={handleForgot}>
                {error   && <div className="msg-error"   style={{ marginBottom: '1rem' }}>{error}</div>}
                {success && <div className="msg-success" style={{ marginBottom: '1rem' }}>{success}</div>}

                <FieldGroup label="Email">
                  <input className="input-field" type="email" placeholder="you@example.com"
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </FieldGroup>

                <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading} style={{ marginTop: '0.5rem' }}>
                  {loading ? <span className="spinner" /> : 'Send reset link'}
                </button>
              </form>
            </div>
          ) : (
            /* ── Main form ── */
            <div className="fade-up">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                {tab === 'login' ? 'Welcome back' : 'Create account'}
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-3)', marginBottom: '1.5rem' }}>
                {tab === 'login' ? 'Sign in to your NexMeet account' : 'Join thousands of teams on NexMeet'}
              </p>

              {/* Tabs */}
              <div style={{
                display: 'flex', background: 'rgba(255,255,255,0.03)',
                borderRadius: 'var(--radius-md)', padding: 3, marginBottom: '1.5rem',
                border: '0.5px solid var(--border)',
              }}>
                {['login','signup'].map(t => (
                  <button key={t} onClick={() => switchTab(t)} style={{
                    flex: 1, padding: '8px', borderRadius: 'var(--radius-sm)',
                    border: t === tab ? '0.5px solid var(--border-purple)' : 'none',
                    background: t === tab ? 'var(--purple-dim)' : 'transparent',
                    color: t === tab ? '#a78bfa' : 'var(--text-3)',
                    fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
                    fontFamily: 'var(--font-body)', letterSpacing: '0.02em',
                    transition: 'all 0.2s',
                  }}>
                    {t === 'login' ? 'Sign In' : 'Sign Up'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit}>
                {error && <div className="msg-error" style={{ marginBottom: '1rem' }}>{error}</div>}

                {tab === 'signup' && (
                  <FieldGroup label="Full Name">
                    <input className="input-field" type="text" placeholder="Your display name"
                      value={name} onChange={e => setName(e.target.value)} required />
                  </FieldGroup>
                )}

                <FieldGroup label="Email">
                  <input className="input-field" type="email" placeholder="you@example.com"
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </FieldGroup>

                <FieldGroup label="Password">
                  <input className="input-field" type="password" placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)} required />
                </FieldGroup>

                {tab === 'signup' && (
                  <FieldGroup label="Confirm Password">
                    <input className="input-field" type="password" placeholder="••••••••"
                      value={confirm} onChange={e => setConfirm(e.target.value)} required />
                  </FieldGroup>
                )}

                {tab === 'login' && (
                  <div style={{ textAlign: 'right', marginTop: '-0.25rem', marginBottom: '1rem' }}>
                    <button type="button" onClick={() => { setView('forgot'); clearMessages() }} style={{
                      background: 'none', border: 'none',
                      color: 'rgba(124,92,252,0.7)', fontSize: '0.75rem',
                      cursor: 'pointer', fontFamily: 'var(--font-body)',
                    }}>
                      Forgot password?
                    </button>
                  </div>
                )}

                <button className="btn btn-primary btn-full" type="submit" disabled={loading}
                  style={{ padding: '12px', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  {loading
                    ? <span className="spinner" />
                    : tab === 'login' ? '✦ Sign In' : '✦ Create Account'
                  }
                </button>
              </form>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
                <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', letterSpacing: '0.05em' }}>or continue with</span>
                <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
              </div>

              {/* Google */}
              <button onClick={handleGoogle} disabled={loading}
                className="btn btn-outline btn-full"
                style={{ gap: 10, padding: '11px', fontSize: '0.85rem' }}>
                <GoogleIcon />
                Continue with Google
              </button>

              <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-4)', marginTop: '1.25rem' }}>
                {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button onClick={() => switchTab(tab === 'login' ? 'signup' : 'login')} style={{
                  background: 'none', border: 'none',
                  color: 'rgba(124,92,252,0.75)', cursor: 'pointer',
                  fontSize: '0.75rem', fontFamily: 'var(--font-body)',
                }}>
                  {tab === 'login' ? 'Create one free' : 'Sign in'}
                </button>
              </p>

              <p style={{ textAlign: 'center', fontSize: '0.68rem', color: 'var(--text-4)', marginTop: '0.75rem' }}>
                By continuing you agree to our{' '}
                <span style={{ color: 'var(--text-3)', cursor: 'pointer' }}>Terms</span> &{' '}
                <span style={{ color: 'var(--text-3)', cursor: 'pointer' }}>Privacy Policy</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FieldGroup({ label, children }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{
        display: 'block', fontSize: '0.72rem',
        color: 'var(--text-3)', marginBottom: 5,
        letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500,
      }}>{label}</label>
      {children}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function friendlyError(code) {
  const map = {
    'auth/user-not-found':       'No account found with this email.',
    'auth/wrong-password':       'Incorrect password.',
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/invalid-email':        'Please enter a valid email address.',
    'auth/weak-password':        'Password must be at least 6 characters.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/too-many-requests':    'Too many attempts. Please try again later.',
    'auth/invalid-credential':   'Incorrect email or password.',
  }
  return map[code] || code || 'Something went wrong. Please try again.'
}