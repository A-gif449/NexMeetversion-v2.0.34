import { useState, useEffect, useRef } from "react";

/**
 * AnnouncementBanner — NexMeet
 * Drop this anywhere in App.jsx or a layout wrapper:
 *   <AnnouncementBanner />
 *
 * Props (all optional):
 *   type          "update" | "maintenance"   default: "update"
 *   title         string
 *   subtitle      string
 *   scheduledFor  string   e.g. "June 12, 2026 · 2:00 PM UTC"
 *   onClose       () => void
 *   autoHide      number   ms before auto-dismiss (0 = never)
 */

const PRESETS = {
  update: {
    label: "INCOMING UPDATE",
    icon: "⚡",
    accentA: "#00f0ff",
    accentB: "#7b2fff",
    title: "NexMeet v3.0 is Almost Here",
    subtitle:
      "AI-powered noise cancellation · Spatial audio · 4K screen share · Instant transcripts",
    scheduledFor: "Releasing June 12, 2026 · 2:00 PM UTC",
  },
  maintenance: {
    label: "SCHEDULED MAINTENANCE",
    icon: "🛠",
    accentA: "#ff9500",
    accentB: "#ff2d55",
    title: "Brief Downtime Ahead",
    subtitle:
      "We're upgrading our infrastructure for a faster, more reliable experience. Meetings in progress will not be affected.",
    scheduledFor: "June 10, 2025 · 12:00 AM – 4:00 AM UTC",
  },
};

export default function AnnouncementBanner({
  type = "update",
  title,
  subtitle,
  scheduledFor,
  onClose,
  autoHide = 0,
}) {
  const preset = PRESETS[type] ?? PRESETS.update;
  const cfg = {
    label: preset.label,
    icon: preset.icon,
    accentA: preset.accentA,
    accentB: preset.accentB,
    title: title ?? preset.title,
    subtitle: subtitle ?? preset.subtitle,
    scheduledFor: scheduledFor ?? preset.scheduledFor,
  };

  const [visible, setVisible] = useState(false);   // animation gate
  const [gone, setGone] = useState(false);          // remove from DOM
  const [progress, setProgress] = useState(100);
  const timerRef = useRef(null);
  const startRef = useRef(null);

  // Entrance after mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Auto-hide countdown
  useEffect(() => {
    if (!autoHide || autoHide <= 0) return;
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / autoHide) * 100);
      setProgress(pct);
      if (pct === 0) {
        clearInterval(timerRef.current);
        dismiss();
      }
    }, 50);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoHide]);

  const dismiss = () => {
    setVisible(false);
    setTimeout(() => {
      setGone(true);
      onClose?.();
    }, 600);
  };

  if (gone) return null;

  return (
    <>
      {/* ── Inline styles (no CSS file needed) ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap');

        .nexbanner-root {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 99999;
          display: flex;
          justify-content: center;
          padding: 14px 16px;
          pointer-events: none;
          font-family: 'DM Sans', sans-serif;
        }

        /* ── Entrance / exit ── */
        .nexbanner-card {
          pointer-events: all;
          width: 100%;
          max-width: 780px;
          border-radius: 20px;
          overflow: hidden;
          position: relative;
          background: rgba(8, 8, 14, 0.82);
          backdrop-filter: blur(28px) saturate(1.8);
          -webkit-backdrop-filter: blur(28px) saturate(1.8);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.04),
            0 32px 80px rgba(0,0,0,0.55),
            0 0 120px -20px var(--accent-a);
          transform: translateY(-110%) scale(0.96);
          opacity: 0;
          transition:
            transform 0.65s cubic-bezier(0.22,1,0.36,1),
            opacity 0.45s ease,
            box-shadow 0.65s ease;
        }
        .nexbanner-card.in {
          transform: translateY(0) scale(1);
          opacity: 1;
        }

        /* ── Ambient gradient top bar ── */
        .nexbanner-bar {
          height: 3px;
          background: linear-gradient(90deg, var(--accent-a), var(--accent-b), var(--accent-a));
          background-size: 200% 100%;
          animation: barSlide 3s linear infinite;
        }
        @keyframes barSlide {
          0%   { background-position: 0% 0%; }
          100% { background-position: 200% 0%; }
        }

        /* ── Glowing orb ── */
        .nexbanner-orb {
          position: absolute;
          top: -60px; right: -60px;
          width: 220px; height: 220px;
          border-radius: 50%;
          background: radial-gradient(circle, var(--accent-b) 0%, transparent 70%);
          opacity: 0.18;
          pointer-events: none;
          animation: orbPulse 4s ease-in-out infinite alternate;
        }
        @keyframes orbPulse {
          from { transform: scale(1);   opacity: 0.18; }
          to   { transform: scale(1.3); opacity: 0.28; }
        }

        /* ── Body ── */
        .nexbanner-body {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 18px 22px 20px;
        }

        /* ── Icon chip ── */
        .nexbanner-chip {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .nexbanner-icon-wrap {
          width: 52px; height: 52px;
          border-radius: 14px;
          background: linear-gradient(135deg, var(--accent-a) 0%, var(--accent-b) 100%);
          display: flex; align-items: center; justify-content: center;
          font-size: 24px;
          box-shadow: 0 0 24px -4px var(--accent-a);
          animation: iconBounce 2.4s ease-in-out infinite;
        }
        @keyframes iconBounce {
          0%,100% { transform: translateY(0) rotate(0deg); }
          45%     { transform: translateY(-5px) rotate(-6deg); }
          55%     { transform: translateY(-5px) rotate(6deg); }
        }
        .nexbanner-label {
          font-family: 'Syne', sans-serif;
          font-size: 8.5px;
          font-weight: 800;
          letter-spacing: 0.14em;
          color: var(--accent-a);
          text-transform: uppercase;
          white-space: nowrap;
        }

        /* ── Text ── */
        .nexbanner-text { flex: 1; min-width: 0; }
        .nexbanner-title {
          font-family: 'Syne', sans-serif;
          font-size: 17px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.01em;
          line-height: 1.25;
          margin: 0 0 5px;
          /* shimmer on title */
          background: linear-gradient(90deg, #fff 30%, var(--accent-a) 50%, #fff 70%);
          background-size: 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 5s linear infinite;
        }
        @keyframes shimmer {
          0%   { background-position: 100%; }
          100% { background-position: -100%; }
        }
        .nexbanner-sub {
          font-size: 13px;
          color: rgba(255,255,255,0.55);
          line-height: 1.5;
          margin: 0 0 8px;
        }
        .nexbanner-schedule {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 100px;
          padding: 4px 10px;
          font-size: 11.5px;
          color: rgba(255,255,255,0.7);
          font-weight: 500;
        }
        .nexbanner-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--accent-a);
          box-shadow: 0 0 6px var(--accent-a);
          animation: dotPing 1.4s ease-in-out infinite;
        }
        @keyframes dotPing {
          0%,100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.6); opacity: 0.5; }
        }

        /* ── Close ── */
        .nexbanner-close {
          flex-shrink: 0;
          width: 34px; height: 34px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.45);
          font-size: 17px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.2s, color 0.2s, transform 0.2s;
          line-height: 1;
        }
        .nexbanner-close:hover {
          background: rgba(255,255,255,0.12);
          color: #fff;
          transform: rotate(90deg);
        }

        /* ── Auto-hide progress ── */
        .nexbanner-progress {
          height: 2px;
          background: linear-gradient(90deg, var(--accent-a), var(--accent-b));
          transform-origin: left;
          transition: width 0.1s linear;
          border-radius: 0 0 20px 20px;
        }

        /* ── Responsive ── */
        @media (max-width: 560px) {
          .nexbanner-title { font-size: 14px; }
          .nexbanner-sub   { font-size: 12px; }
          .nexbanner-icon-wrap { width: 42px; height: 42px; font-size: 20px; }
        }
      `}</style>

      <div className="nexbanner-root">
        <div
          className={`nexbanner-card ${visible ? "in" : ""}`}
          style={{
            "--accent-a": cfg.accentA,
            "--accent-b": cfg.accentB,
          }}
        >
          {/* animated top bar */}
          <div className="nexbanner-bar" />

          {/* glow orb */}
          <div className="nexbanner-orb" />

          {/* main content */}
          <div className="nexbanner-body">
            {/* icon + label */}
            <div className="nexbanner-chip">
              <div className="nexbanner-icon-wrap">{cfg.icon}</div>
              <span className="nexbanner-label">{cfg.label}</span>
            </div>

            {/* text */}
            <div className="nexbanner-text">
              <h2 className="nexbanner-title">{cfg.title}</h2>
              <p className="nexbanner-sub">{cfg.subtitle}</p>
              <span className="nexbanner-schedule">
                <span className="nexbanner-dot" />
                {cfg.scheduledFor}
              </span>
            </div>

            {/* close */}
            <button
              className="nexbanner-close"
              onClick={dismiss}
              aria-label="Dismiss announcement"
            >
              ✕
            </button>
          </div>

          {/* auto-hide progress bar */}
          {autoHide > 0 && (
            <div
              className="nexbanner-progress"
              style={{ width: `${progress}%` }}
            />
          )}
        </div>
      </div>
    </>
  );
}