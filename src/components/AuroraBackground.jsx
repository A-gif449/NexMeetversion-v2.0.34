// src/components/AuroraBackground.jsx
// Optimized: removed canvas animation loop entirely.
// Stars are now pure CSS — looks identical, zero JS overhead on every page.

import './AuroraBackground.css'

export default function AuroraBackground({ children }) {
  return (
    <div className="aurora-root">
      {/* ── Layer 1: base void ── */}
      <div className="aurora-void" />

      {/* ── Layer 2: animated gradient mesh ── */}
      <div className="aurora-mesh" />

      {/* ── Layer 3: large drifting orbs ── */}
      <div className="aurora-orb aurora-orb--1" />
      <div className="aurora-orb aurora-orb--2" />
      <div className="aurora-orb aurora-orb--3" />
      <div className="aurora-orb aurora-orb--4" />

      {/* ── Layer 4: dot grid ── */}
      <div className="aurora-dots" />

      {/* ── Layer 5: scan-line shimmer ── */}
      <div className="aurora-scanlines" />

      {/* ── Layer 6: pure CSS stars (replaces canvas loop) ── */}
      <div className="aurora-stars" />

      {/* ── Layer 7: vignette ── */}
      <div className="aurora-vignette" />

      {/* ── Page content on top ── */}
      <div className="aurora-content">
        {children}
      </div>
    </div>
  )
}