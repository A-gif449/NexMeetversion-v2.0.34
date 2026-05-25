// src/components/Navbar.jsx
import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../firebase/AuthContext'

export default function Navbar() {
  const { user, logOut } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logOut()
    navigate('/login')
    setMenuOpen(false)
  }

  const isActive = (path) => location.pathname === path

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(5,5,8,0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '0.5px solid var(--border)',
      }}>
        <div className="container" style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', height: 60,
        }}>
          {/* Logo */}
          <Link
            to={user ? '/rooms' : '/'}
            onClick={() => setMenuOpen(false)}
            style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: '1.15rem', color: 'var(--text-1)', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--purple)',
              boxShadow: '0 0 10px var(--purple-glow)',
              display: 'inline-block', flexShrink: 0,
            }} />
            NexMeet
          </Link>

          {/* Desktop nav links — hidden on mobile */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '1.5rem',
          }} className="nm-nav-links">
            {user && (
              <>
                <NavLink to="/rooms"   active={isActive('/rooms')}>Rooms</NavLink>
                <NavLink to="/pricing" active={isActive('/pricing')}>Pricing</NavLink>
                <NavLink to="/support" active={isActive('/support')}>Support</NavLink>
              </>
            )}
            {!user && (
              <>
                <NavLink to="/pricing" active={isActive('/pricing')}>Pricing</NavLink>
                <NavLink to="/support" active={isActive('/support')}>Support</NavLink>
              </>
            )}
          </div>

          {/* Desktop right side — hidden on mobile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }} className="nm-nav-right">
            {user ? (
              <>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 12px 4px 4px',
                  background: 'var(--bg-card)', borderRadius: 100,
                  border: '0.5px solid var(--border)',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--purple), var(--blue))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 700, color: '#fff',
                    overflow: 'hidden', flexShrink: 0,
                  }}>
                    {user.photoURL
                      ? <img src={user.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (user.displayName || user.email || 'U')[0].toUpperCase()
                    }
                  </div>
                  <span style={{
                    fontSize: '0.78rem', color: 'var(--text-2)',
                    maxWidth: 100, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                </div>
                <button className="btn btn-outline btn-sm" onClick={handleLogout}>Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
                <Link to="/login?tab=signup" className="btn btn-primary btn-sm">Get started</Link>
              </>
            )}
          </div>

          {/* Hamburger — shown on mobile only */}
          <button
            className="nm-hamburger"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
            style={{
              display: 'none',
              background: 'none', border: 'none',
              color: 'var(--text-2)', cursor: 'pointer',
              padding: 6, borderRadius: 8,
              flexDirection: 'column', gap: 5, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{
              display: 'block', width: 22, height: 2,
              background: 'currentColor', borderRadius: 2,
              transform: menuOpen ? 'rotate(45deg) translateY(5px)' : 'none',
              transition: 'transform 0.2s',
            }} />
            <span style={{
              display: 'block', width: 22, height: 2,
              background: 'currentColor', borderRadius: 2,
              opacity: menuOpen ? 0 : 1,
              transition: 'opacity 0.2s',
            }} />
            <span style={{
              display: 'block', width: 22, height: 2,
              background: 'currentColor', borderRadius: 2,
              transform: menuOpen ? 'rotate(-45deg) translateY(-5px)' : 'none',
              transition: 'transform 0.2s',
            }} />
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div style={{
          position: 'fixed', top: 60, left: 0, right: 0, zIndex: 99,
          background: 'rgba(9,9,11,0.98)',
          borderBottom: '0.5px solid var(--border)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '1rem',
          display: 'flex', flexDirection: 'column', gap: 8,
          animation: 'fade-up 0.2s ease',
        }}>
          {user && (
            <>
              {/* User info */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px',
                background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
                border: '0.5px solid var(--border)',
                marginBottom: 4,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--purple), var(--blue))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.85rem', fontWeight: 700, color: '#fff',
                  overflow: 'hidden', flexShrink: 0,
                }}>
                  {user.photoURL
                    ? <img src={user.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (user.displayName || user.email || 'U')[0].toUpperCase()
                  }
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-1)' }}>
                    {user.displayName || 'User'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-4)' }}>
                    {user.email}
                  </div>
                </div>
              </div>

              <MobileNavLink to="/rooms"   onClick={() => setMenuOpen(false)} active={isActive('/rooms')}>🏠 Rooms</MobileNavLink>
              <MobileNavLink to="/pricing" onClick={() => setMenuOpen(false)} active={isActive('/pricing')}>💎 Pricing</MobileNavLink>
              <MobileNavLink to="/support" onClick={() => setMenuOpen(false)} active={isActive('/support')}>🛟 Support</MobileNavLink>
              <button
                onClick={handleLogout}
                style={{
                  width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.2)',
                  color: '#f87171', fontSize: '0.875rem', cursor: 'pointer',
                  fontFamily: 'var(--font-body)', marginTop: 4,
                }}
              >
                Sign out
              </button>
            </>
          )}
          {!user && (
            <>
              <MobileNavLink to="/pricing" onClick={() => setMenuOpen(false)} active={isActive('/pricing')}>💎 Pricing</MobileNavLink>
              <MobileNavLink to="/support" onClick={() => setMenuOpen(false)} active={isActive('/support')}>🛟 Support</MobileNavLink>
              <Link to="/login" onClick={() => setMenuOpen(false)} className="btn btn-outline btn-md" style={{ width: '100%' }}>Sign in</Link>
              <Link to="/login?tab=signup" onClick={() => setMenuOpen(false)} className="btn btn-primary btn-md" style={{ width: '100%' }}>Get started</Link>
            </>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .nm-nav-links { display: none !important; }
          .nm-nav-right  { display: none !important; }
          .nm-hamburger  { display: flex !important; }
        }
      `}</style>
    </>
  )
}

function NavLink({ to, active, children }) {
  return (
    <Link to={to} style={{
      fontSize: '0.85rem', fontWeight: 400,
      color: active ? 'var(--text-1)' : 'var(--text-3)',
      textDecoration: 'none', transition: 'color 0.2s', position: 'relative',
    }}>
      {children}
      {active && (
        <span style={{
          position: 'absolute', bottom: -4, left: 0, right: 0,
          height: 1, background: 'var(--purple)', borderRadius: 1,
        }} />
      )}
    </Link>
  )
}

function MobileNavLink({ to, active, onClick, children }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      style={{
        display: 'block', padding: '12px 14px',
        borderRadius: 'var(--radius-sm)',
        background: active ? 'var(--purple-dim)' : 'transparent',
        border: `0.5px solid ${active ? 'var(--border-purple)' : 'transparent'}`,
        color: active ? '#a78bfa' : 'var(--text-2)',
        textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500,
        transition: 'all 0.15s',
      }}
    >
      {children}
    </Link>
  )
}