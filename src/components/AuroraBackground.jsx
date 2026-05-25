// src/components/AuroraBackground.jsx
// Drop-in global background — place ONCE in App.jsx, wraps all pages.
// Zero props needed. Fully self-contained. Touches nothing else.

import { useEffect, useRef } from 'react'
import './AuroraBackground.css'

export default function AuroraBackground({ children }) {
  const canvasRef = useRef(null)

  // Lightweight particle / star-field on canvas so it never conflicts with page content
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf

    const STARS = 110
    const stars = Array.from({ length: STARS }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 0.9 + 0.2,
      a: Math.random(),
      speed: Math.random() * 0.0003 + 0.0001,
      twinkleOffset: Math.random() * Math.PI * 2,
    }))

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    let t = 0
    const draw = () => {
      t += 0.008
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      stars.forEach(s => {
        const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.8 + s.twinkleOffset))
        ctx.beginPath()
        ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(210,200,255,${twinkle * 0.55})`
        ctx.fill()
        // Drift slowly
        s.y += s.speed
        if (s.y > 1) { s.y = 0; s.x = Math.random() }
      })

      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

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

      {/* ── Layer 4: dot grid (takeUforward style) ── */}
      <div className="aurora-dots" />

      {/* ── Layer 5: scan-line shimmer ── */}
      <div className="aurora-scanlines" />

      {/* ── Layer 6: star canvas ── */}
      <canvas ref={canvasRef} className="aurora-stars" />

      {/* ── Layer 7: vignette ── */}
      <div className="aurora-vignette" />

      {/* ── Page content on top ── */}
      <div className="aurora-content">
        {children}
      </div>
    </div>
  )
}