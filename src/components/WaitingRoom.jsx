// WaitingRoom.jsx
// Place this in: src/components/WaitingRoom.jsx
//
// USAGE in Room.jsx:
//   import WaitingRoom from '../components/WaitingRoom'
//   Show this component when waitingStatus === 'waiting'

import { useEffect, useState } from "react";

export default function WaitingRoom({ roomId, user, isHost, onAdmitted, onDenied }) {

  // ✅ Safety net: if somehow host lands here, auto-admit immediately
  useEffect(() => {
    if (isHost) {
      onAdmitted?.()
    }
  }, [isHost, onAdmitted])

  // ✅ Don't render the waiting UI for the host at all
  if (isHost) return null

  return <WaitingUI roomId={roomId} user={user} onDenied={onDenied} />
}

function WaitingUI({ roomId, user, onDenied }) {
  const [dots, setDots] = useState("");
  const [timeWaiting, setTimeWaiting] = useState(0);

  // Animate the dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Track wait time
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeWaiting((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <div style={styles.overlay}>
      {/* Animated background orbs */}
      <div style={styles.orb1} />
      <div style={styles.orb2} />

      <div style={styles.card}>
        {/* Top status bar */}
        <div style={styles.statusBar}>
          <span style={styles.statusDot} />
          <span style={styles.statusText}>Waiting for host</span>
        </div>

        {/* Avatar */}
        <div style={styles.avatarWrapper}>
          <div style={styles.avatarRing} />
          <img
            src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}&background=7c3aed&color=fff`}
            alt={user?.displayName}
            style={styles.avatar}
          />
        </div>

        {/* Text */}
        <h2 style={styles.heading}>
          Almost there{dots}
        </h2>
        <p style={styles.subtext}>
          The host will let you in soon. Hang tight!
        </p>

        {/* Room info */}
        <div style={styles.roomBadge}>
          <span style={styles.roomIcon}>🔗</span>
          <span style={styles.roomId}>Room: {roomId}</span>
        </div>

        {/* Wait timer */}
        <div style={styles.timerRow}>
          <span style={styles.timerLabel}>Waiting for</span>
          <span style={styles.timerValue}>{formatTime(timeWaiting)}</span>
        </div>

        {/* Tips */}
        <div style={styles.tipBox}>
          <span style={styles.tipIcon}>💡</span>
          <span style={styles.tipText}>
            Make sure your camera and mic are ready before you join.
          </span>
        </div>

        {/* Leave button */}
        <button
          style={styles.leaveBtn}
          onClick={onDenied}
          onMouseEnter={(e) => (e.target.style.background = "#3f3f46")}
          onMouseLeave={(e) => (e.target.style.background = "transparent")}
        >
          Leave
        </button>
      </div>

      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes float-orb {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-30px); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "#09090b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    overflow: "hidden",
  },
  orb1: {
    position: "absolute",
    width: 400,
    height: 400,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)",
    top: -100,
    left: -100,
    animation: "float-orb 6s ease-in-out infinite",
  },
  orb2: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)",
    bottom: -50,
    right: -50,
    animation: "float-orb 8s ease-in-out infinite reverse",
  },
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 24,
    padding: "40px 48px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    maxWidth: 420,
    width: "90%",
    backdropFilter: "blur(20px)",
    animation: "fade-in 0.5s ease-out",
    position: "relative",
    zIndex: 1,
  },
  statusBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(124,58,237,0.15)",
    border: "1px solid rgba(124,58,237,0.3)",
    borderRadius: 100,
    padding: "6px 16px",
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#a78bfa",
    boxShadow: "0 0 8px #a78bfa",
    display: "inline-block",
    animation: "pulse-ring 1.5s ease-out infinite",
  },
  statusText: {
    color: "#a78bfa",
    fontSize: 13,
    fontWeight: 500,
  },
  avatarWrapper: {
    position: "relative",
    width: 88,
    height: 88,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarRing: {
    position: "absolute",
    inset: -6,
    borderRadius: "50%",
    border: "2px solid rgba(124,58,237,0.5)",
    animation: "pulse-ring 2s ease-out infinite",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    objectFit: "cover",
    border: "2px solid rgba(124,58,237,0.6)",
  },
  heading: {
    color: "#fff",
    fontSize: 24,
    fontWeight: 700,
    margin: 0,
    textAlign: "center",
    minWidth: 200,
  },
  subtext: {
    color: "#71717a",
    fontSize: 14,
    margin: 0,
    textAlign: "center",
    lineHeight: 1.6,
  },
  roomBadge: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "8px 16px",
    marginTop: 4,
  },
  roomIcon: { fontSize: 14 },
  roomId: {
    color: "#a1a1aa",
    fontSize: 13,
    fontFamily: "monospace",
  },
  timerRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  timerLabel: {
    color: "#52525b",
    fontSize: 13,
  },
  timerValue: {
    color: "#a78bfa",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "monospace",
  },
  tipBox: {
    display: "flex",
    gap: 10,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: "12px 16px",
    marginTop: 4,
  },
  tipIcon: { fontSize: 14, flexShrink: 0 },
  tipText: {
    color: "#52525b",
    fontSize: 13,
    lineHeight: 1.5,
  },
  leaveBtn: {
    marginTop: 8,
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#71717a",
    borderRadius: 10,
    padding: "10px 32px",
    fontSize: 14,
    cursor: "pointer",
    transition: "all 0.2s",
    width: "100%",
  },
};