// src/components/Footer.jsx
import { Link } from 'react-router-dom'

const LINKS = [
  { label: 'About',   to: '/about'   },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Privacy Policy',          to: '/privacy'  },
  { label: 'Terms and Conditions',    to: '/terms'    },
  { label: 'Cancellation & Refunds',  to: '/refunds'  },
]

const SOCIALS = [
  {
    label: 'Instagram',
    href: 'https://instagram.com',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
        <circle cx="12" cy="12" r="4"/>
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://linkedin.com',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
        <rect x="2" y="9" width="4" height="12"/>
        <circle cx="4" cy="4" r="2"/>
      </svg>
    ),
  },
  {
    label: 'YouTube',
    href: 'https://youtube.com',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
        <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/>
      </svg>
    ),
  },
]

export default function Footer() {
  return (
    <footer style={{
      borderTop: '0.5px solid var(--border)',
      background: 'rgba(5,5,15,0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      marginTop: 'auto',
    }}>
      <div className="container">

        {/* ── Main row ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1.1rem 0',
        }}>

          {/* Logo */}
          <Link
            to="/"
            style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: '1.05rem', color: 'var(--text-1)',
              textDecoration: 'none',
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

          {/* Nav links */}
          <nav style={{
            display: 'flex', alignItems: 'center',
            flexWrap: 'wrap', gap: '0 0.1rem',
          }}>
            {LINKS.map((link, i) => (
              <span key={link.to} style={{ display: 'flex', alignItems: 'center' }}>
                <Link
                  to={link.to}
                  style={{
                    fontSize: '0.78rem', color: 'var(--text-3)',
                    textDecoration: 'none', padding: '2px 10px',
                    transition: 'color 0.2s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => e.target.style.color = 'var(--text-1)'}
                  onMouseLeave={e => e.target.style.color = 'var(--text-3)'}
                >
                  {link.label}
                </Link>
                {i < LINKS.length - 1 && (
                  <span style={{ color: 'var(--border)', fontSize: '0.75rem', userSelect: 'none' }}>|</span>
                )}
              </span>
            ))}
          </nav>

          {/* Social icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {SOCIALS.map(s => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-3)',
                  border: '0.5px solid var(--border)',
                  background: 'var(--bg-card)',
                  transition: 'all 0.2s',
                  textDecoration: 'none',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = 'var(--text-1)'
                  e.currentTarget.style.borderColor = 'var(--border-purple)'
                  e.currentTarget.style.background = 'var(--purple-dim)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'var(--text-3)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.background = 'var(--bg-card)'
                }}
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>

        {/* ── Copyright row ── */}
        <div style={{
          borderTop: '0.5px solid var(--border)',
          padding: '0.75rem 0',
          textAlign: 'center',
          fontSize: '0.72rem',
          color: 'var(--text-4)',
          fontStyle: 'italic',
          letterSpacing: '0.01em',
        }}>
          Copyright © {new Date().getFullYear()} NexMeet · All rights reserved
        </div>

      </div>

      {/* Mobile stacking */}
      <style>{`
        @media (max-width: 768px) {
          .nm-footer-nav { justify-content: center !important; }
        }
        @media (max-width: 560px) {
          .nm-footer-row {
            flex-direction: column !important;
            align-items: center !important;
            text-align: center;
          }
        }
      `}</style>
    </footer>
  )
}