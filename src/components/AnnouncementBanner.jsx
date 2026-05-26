// src/components/AnnouncementBanner.jsx
import { useState, useEffect } from 'react'

const ANNOUNCEMENTS = {
  update: {
    icon: '⚡',
    iconBg: 'linear-gradient(135deg, #38bdf8, #7c5cf8)',
    label: 'INCOMING UPDATE',
    labelColor: '#38bdf8',
    title: 'NexM v3.0 is Almost Here',
    features: [
      'AI-powered noise cancellation',
      'Spatial audio',
      '4K screen share',
      'Instant transcripts',
    ],
    releaseDate: 'June 12, 2026 · 2:00 PM UTC',
    storageKey: 'nxl-banner-update-v3',
  },
}

export default function AnnouncementBanner({ type = 'update' }) {
  const config = ANNOUNCEMENTS[type]
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!config) return
    const dismissed = localStorage.getItem(config.storageKey)
    if (!dismissed) setVisible(true)
  }, [])

  const dismiss = () => {
    localStorage.setItem(config.storageKey, '1')
    setVisible(false)
  }

  if (!visible || !config) return null

  return (
    <>
      <style>{`
        .ann-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(4px);
          box-sizing: border-box;
        }

        .ann-card {
          position: relative;
          display: flex;
          flex-direction: row;
          align-items: stretch;
          width: 100%;
          max-width: 520px;
          background: #0f0f1a;
          border: 0.5px solid rgba(124, 92, 252, 0.35);
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 24px 80px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.05) inset;
          box-sizing: border-box;
        }

        /* Left accent strip */
        .ann-left {
          width: 130px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 1.5rem 1rem;
          background: rgba(56, 189, 248, 0.04);
          border-right: 0.5px solid rgba(255,255,255,0.06);
        }

        .ann-icon-wrap {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          box-shadow: 0 0 24px rgba(56,189,248,0.3);
        }

        .ann-label {
          font-size: 0.55rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-align: center;
          text-transform: uppercase;
        }

        /* Right content */
        .ann-right {
          flex: 1;
          min-width: 0;
          padding: 1.25rem 1.25rem 1.25rem 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .ann-title {
          font-size: 1rem;
          font-weight: 800;
          color: #fff;
          line-height: 1.25;
          letter-spacing: -0.02em;
          font-family: var(--font-display, sans-serif);
          margin: 0;
        }

        .ann-features {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .ann-feature-pill {
          font-size: 0.68rem;
          color: rgba(255,255,255,0.6);
          background: rgba(255,255,255,0.05);
          border: 0.5px solid rgba(255,255,255,0.08);
          border-radius: 100px;
          padding: 3px 9px;
          white-space: nowrap;
        }

        .ann-date {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          color: rgba(255,255,255,0.45);
          background: rgba(255,255,255,0.04);
          border: 0.5px solid rgba(255,255,255,0.08);
          border-radius: 100px;
          padding: 4px 10px;
          align-self: flex-start;
        }

        .ann-date-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #38bdf8;
          box-shadow: 0 0 6px #38bdf8;
          flex-shrink: 0;
        }

        .ann-close {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: rgba(255,255,255,0.07);
          border: 0.5px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.5);
          font-size: 0.75rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s, color 0.2s;
          z-index: 2;
          flex-shrink: 0;
        }
        .ann-close:hover {
          background: rgba(255,255,255,0.14);
          color: #fff;
        }

        /* Mobile tweaks */
        @media (max-width: 480px) {
          .ann-overlay {
            padding: 0.75rem;
            align-items: flex-end;
          }
          .ann-card {
            max-width: 100%;
            border-radius: 16px;
          }
          .ann-left {
            width: 100px;
            padding: 1.25rem 0.75rem;
          }
          .ann-icon-wrap {
            width: 44px;
            height: 44px;
            font-size: 1.25rem;
          }
          .ann-right {
            padding: 1rem 2.25rem 1rem 1rem;
          }
          .ann-title {
            font-size: 0.9rem;
          }
        }
      `}</style>

      <div className="ann-overlay" onClick={dismiss}>
        <div className="ann-card" onClick={e => e.stopPropagation()}>

          {/* Close button */}
          <button className="ann-close" onClick={dismiss} aria-label="Dismiss">✕</button>

          {/* Left strip */}
          <div className="ann-left">
            <div
              className="ann-icon-wrap"
              style={{ background: config.iconBg }}
            >
              {config.icon}
            </div>
            <span className="ann-label" style={{ color: config.labelColor }}>
              {config.label}
            </span>
          </div>

          {/* Right content */}
          <div className="ann-right">
            <p className="ann-title">{config.title}</p>

            <ul className="ann-features">
              {config.features.map(f => (
                <li key={f} className="ann-feature-pill">{f}</li>
              ))}
            </ul>

            <div className="ann-date">
              <span className="ann-date-dot" />
              Releasing {config.releaseDate}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}