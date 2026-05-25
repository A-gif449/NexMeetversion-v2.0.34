// src/components/WaitingRoom.jsx
// OPTIMIZED: No inline style object recreation, CSS classes for animations,
// single interval for both dots + timer, hover via CSS, stable keyframes.

import { useEffect, useState, useCallback, useMemo, useRef } from "react";

// ─── Keyframes + CSS injected ONCE at module level, not on every render ───
const STYLES = `
  .wr-overlay {
    position: fixed;
    inset: 0;
    background: #09090b;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    overflow: hidden;
  }
  .wr-orb {
    position: absolute;
    border-radius: 50%;
    will-change: transform;
  }
  .wr-orb--1 {
    width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%);
    top: -100px; left: -100px;
    animation: wr-float 6s ease-in-out infinite;
  }
  .wr-orb--2 {
    width: 300px; height: 300px;
    background: radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%);
    bottom: -50px; right: -50px;
    animation: wr-float 8s ease-in-out infinite reverse;
  }
  .wr-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 24px;
    padding: 40px 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    max-width: 420px;
    width: 90%;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    animation: wr-fadein 0.5s ease-out both;
    position: relative;
    z-index: 1;
  }
  .wr-status-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(124,58,237,0.15);
    border: 1px solid rgba(124,58,237,0.3);
    border-radius: 100px;
    padding: 6px 16px;
    margin-bottom: 8px;
  }
  .wr-status-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #a78bfa;
    box-shadow: 0 0 8px #a78bfa;
    display: inline-block;
    animation: wr-pulse 1.5s ease-out infinite;
    will-change: transform, opacity;
  }
  .wr-status-text {
    color: #a78bfa;
    font-size: 13px;
    font-weight: 500;
  }
  .wr-avatar-wrapper {
    position: relative;
    width: 88px; height: 88px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 4px;
  }
  .wr-avatar-ring {
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 2px solid rgba(124,58,237,0.5);
    animation: wr-pulse 2s ease-out infinite;
    will-change: transform, opacity;
  }
  .wr-avatar {
    width: 80px; height: 80px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(124,58,237,0.6);
  }
  .wr-avatar--initial {
    width: 80px; height: 80px;
    border-radius: 50%;
    border: 2px solid rgba(124,58,237,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #7c3aed, #3b82f6);
    font-size: 1.75rem;
    font-weight: 700;
    color: #fff;
    font-family: system-ui, sans-serif;
    user-select: none;
  }
  .wr-heading {
    color: #fff;
    font-size: 24px;
    font-weight: 700;
    margin: 0;
    text-align: center;
    min-width: 200px;
  }
  .wr-subtext {
    color: #71717a;
    font-size: 14px;
    margin: 0;
    text-align: center;
    line-height: 1.6;
  }
  .wr-room-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    padding: 8px 16px;
    margin-top: 4px;
  }
  .wr-room-id {
    color: #a1a1aa;
    font-size: 13px;
    font-family: monospace;
  }
  .wr-timer-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .wr-timer-label { color: #52525b; font-size: 13px; }
  .wr-timer-value {
    color: #a78bfa;
    font-size: 13px;
    font-weight: 600;
    font-family: monospace;
  }
  .wr-tip-box {
    display: flex;
    gap: 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 12px 16px;
    margin-top: 4px;
  }
  .wr-tip-text { color: #52525b; font-size: 13px; line-height: 1.5; }
  .wr-leave-btn {
    margin-top: 8px;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.1);
    color: #71717a;
    border-radius: 10px;
    padding: 10px 32px;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s;
    width: 100%;
  }
  .wr-leave-btn:hover { background: #3f3f46; }

  @keyframes wr-pulse {
    0%   { transform: scale(1);   opacity: 0.6; }
    100% { transform: scale(1.5); opacity: 0; }
  }
  @keyframes wr-float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-30px); }
  }
  @keyframes wr-fadein {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

// Inject styles once — never on re-render
if (typeof document !== "undefined" && !document.getElementById("wr-styles")) {
  const el = document.createElement("style");
  el.id = "wr-styles";
  el.textContent = STYLES;
  document.head.appendChild(el);
}

// ─── formatTime is pure — defined outside component so it's never recreated ───
function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function WaitingRoom({ roomId, user, isHost, onAdmitted, onDenied }) {
  // Safety net: host auto-admits immediately
  useEffect(() => {
    if (isHost) onAdmitted?.();
  }, [isHost, onAdmitted]);

  if (isHost) return null;

  return <WaitingUI roomId={roomId} user={user} onDenied={onDenied} />;
}

// ─── WaitingUI ────────────────────────────────────────────────────────────────
function WaitingUI({ roomId, user, onDenied }) {
  const [tick, setTick]       = useState(0);   // drives both dots + timer
  const [imgError, setImgError] = useState(false);

  // Single interval drives both the dots animation and the wait timer
  // Avoids having two setInterval calls running simultaneously
  const tickRef = useRef(0);
  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1;
      setTick(tickRef.current);
    }, 500);
    return () => clearInterval(id);
  }, []);

  // Derive dots and time from a single tick counter — no extra state
  const dots        = useMemo(() => ".".repeat(tick % 4),          [tick]);
  const timeWaiting = useMemo(() => Math.floor(tick / 2),          [tick]); // every 2 ticks = 1s
  const timeLabel   = useMemo(() => formatTime(timeWaiting),       [timeWaiting]);

  // Stable callback — won't cause img remount on re-renders
  const handleImgError = useCallback(() => setImgError(true), []);

  const displayName = user?.displayName || user?.email || "U";
  const initial     = displayName[0].toUpperCase();
  const showPhoto   = Boolean(user?.photoURL) && !imgError;

  return (
    <div className="wr-overlay">
      <div className="wr-orb wr-orb--1" />
      <div className="wr-orb wr-orb--2" />

      <div className="wr-card">
        {/* Status bar */}
        <div className="wr-status-bar">
          <span className="wr-status-dot" />
          <span className="wr-status-text">Waiting for host</span>
        </div>

        {/* Avatar */}
        <div className="wr-avatar-wrapper">
          <div className="wr-avatar-ring" />
          {showPhoto ? (
            <img
              src={user.photoURL}
              alt={displayName}
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              onError={handleImgError}
              className="wr-avatar"
            />
          ) : (
            <div className="wr-avatar--initial">{initial}</div>
          )}
        </div>

        {/* Text */}
        <h2 className="wr-heading">Almost there{dots}</h2>
        <p className="wr-subtext">The host will let you in soon. Hang tight!</p>

        {/* Room badge */}
        <div className="wr-room-badge">
          <span style={{ fontSize: 14 }}>🔗</span>
          <span className="wr-room-id">Room: {roomId}</span>
        </div>

        {/* Timer */}
        <div className="wr-timer-row">
          <span className="wr-timer-label">Waiting for</span>
          <span className="wr-timer-value">{timeLabel}</span>
        </div>

        {/* Tip */}
        <div className="wr-tip-box">
          <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
          <span className="wr-tip-text">
            Make sure your camera and mic are ready before you join.
          </span>
        </div>

        {/* Leave */}
        <button className="wr-leave-btn" onClick={onDenied}>
          Leave
        </button>
      </div>
    </div>
  );
}