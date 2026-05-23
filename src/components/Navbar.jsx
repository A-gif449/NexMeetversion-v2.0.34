// src/components/Navbar.jsx
import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../firebase/AuthContext'

export default function Navbar() {
  const { user, logOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logOut()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'rgba(5,5,8,0.8)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '0.5px solid var(--border)',
    }}>
      <div className="container" style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: 60,
      }}>
        {/* Logo */}
        <Link to={user ? '/rooms' : '/'} style={{
          fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: '1.2rem', color: 'var(--text-1)', textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--purple)',
            boxShadow: '0 0 10px var(--purple-glow)',
            display: 'inline-block',
          }} />
          NexMeet
        </Link>

        {/* Desktop nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {user && (
            <>
              <NavLink to="/rooms"   active={isActive('/rooms')}>Rooms</NavLink>
              <NavLink to="/pricing" active={isActive('/pricing')}>Pricing</NavLink>
            </>
          )}
          {!user && (
            <NavLink to="/pricing" active={isActive('/pricing')}>Pricing</NavLink>
          )}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {user ? (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '5px 12px 5px 5px',
                background: 'var(--bg-card)', borderRadius: 100,
                border: '0.5px solid var(--border)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--purple), var(--blue))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: 700, color: '#fff',
                  overflow: 'hidden',
                }}>
                  {user.photoURL
                    ? <img src={user.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (user.displayName || user.email || 'U')[0].toUpperCase()
                  }
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-2)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
      </div>
    </nav>
  )
}

function NavLink({ to, active, children }) {
  return (
    <Link to={to} style={{
      fontSize: '0.85rem', fontWeight: 400,
      color: active ? 'var(--text-1)' : 'var(--text-3)',
      textDecoration: 'none',
      transition: 'color 0.2s',
      position: 'relative',
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