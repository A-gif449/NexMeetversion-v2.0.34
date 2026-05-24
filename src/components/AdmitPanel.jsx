// AdmitPanel.jsx
// Place this in: src/components/AdmitPanel.jsx
//
// USAGE in Room.jsx:
//   import AdmitPanel from '../components/AdmitPanel'
//   <AdmitPanel waitingUsers={waitingUsers} onAdmit={handleAdmit} onDeny={handleDeny} />

import { useState, useEffect } from "react";

export default function AdmitPanel({ waitingUsers = [], onAdmit, onDeny }) {
  const [visible, setVisible] = useState(false);
  const [prevCount, setPrevCount] = useState(0);
  const [newEntries, setNewEntries] = useState({});

  // Show panel when someone is waiting
  useEffect(() => {
    setVisible(waitingUsers.length > 0);

    // Track newly added users for highlight animation
    if (waitingUsers.length > prevCount) {
      const latest = waitingUsers[waitingUsers.length - 1];
      if (latest) {
        setNewEntries((prev) => ({ ...prev, [latest.userId]: true }));
        setTimeout(() => {
          setNewEntries((prev) => ({ ...prev, [latest.userId]: false }));
        }, 1000);
      }
    }
    setPrevCount(waitingUsers.length);
  }, [waitingUsers]);

  if (!visible) return null;

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.pulseDot} />
          <span style={styles.headerTitle}>Waiting Room</span>
        </div>
        <div style={styles.badge}>{waitingUsers.length}</div>
      </div>

      {/* User list */}
      <div style={styles.list}>
        {waitingUsers.map((user) => (
          <div
            key={user.userId}
            style={{
              ...styles.userRow,
              ...(newEntries[user.userId] ? styles.userRowNew : {}),
            }}
          >
            {/* Avatar */}
            <img
              src={
                user.photoURL ||
                `https://ui-avatars.com/api/?name=${user.displayName}&background=7c3aed&color=fff`
              }
              alt={user.displayName}
              style={styles.avatar}
            />

            {/* Info */}
            <div style={styles.userInfo}>
              <span style={styles.userName}>{user.displayName}</span>
              <span style={styles.userTime}>
                Waiting {formatWaitTime(user.requestedAt)}
              </span>
            </div>

            {/* Actions */}
            <div style={styles.actions}>
              <button
                style={styles.denyBtn}
                onClick={() => onDeny(user.userId)}
                title="Deny"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(239,68,68,0.2)";
                  e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                }}
              >
                ✕
              </button>
              <button
                style={styles.admitBtn}
                onClick={() => onAdmit(user.userId)}
                title="Admit"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#6d28d9";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#7c3aed";
                }}
              >
                Admit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Admit all button (shows when 2+ waiting) */}
      {waitingUsers.length >= 2 && (
        <button
          style={styles.admitAllBtn}
          onClick={() => waitingUsers.forEach((u) => onAdmit(u.userId))}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          Admit All ({waitingUsers.length})
        </button>
      )}

      <style>{`
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes highlight {
          0% { background: rgba(124,58,237,0.2); }
          100% { background: rgba(255,255,255,0.03); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

function formatWaitTime(ts) {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

const styles = {
  panel: {
    position: "fixed",
    top: 80,
    right: 20,
    width: 320,
    background: "rgba(9,9,11,0.95)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 16,
    zIndex: 999,
    backdropFilter: "blur(20px)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,58,237,0.1)",
    animation: "slide-in 0.3s ease-out",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#a78bfa",
    boxShadow: "0 0 8px #a78bfa",
    animation: "pulse-dot 1.5s ease-in-out infinite",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
  },
  badge: {
    background: "#7c3aed",
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    width: 22,
    height: 22,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  userRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: "10px 12px",
    transition: "background 0.3s",
  },
  userRowNew: {
    animation: "highlight 1s ease-out",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    objectFit: "cover",
    border: "2px solid rgba(124,58,237,0.4)",
    flexShrink: 0,
  },
  userInfo: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  userName: {
    color: "#e4e4e7",
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  userTime: {
    color: "#52525b",
    fontSize: 11,
  },
  actions: {
    display: "flex",
    gap: 6,
    flexShrink: 0,
  },
  denyBtn: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#71717a",
    borderRadius: 8,
    width: 30,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: 12,
    transition: "all 0.2s",
  },
  admitBtn: {
    background: "#7c3aed",
    border: "none",
    color: "#fff",
    borderRadius: 8,
    padding: "0 12px",
    height: 30,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.2s",
  },
  admitAllBtn: {
    marginTop: 10,
    width: "100%",
    background: "rgba(124,58,237,0.15)",
    border: "1px solid rgba(124,58,237,0.3)",
    color: "#a78bfa",
    borderRadius: 10,
    padding: "10px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "opacity 0.2s",
  },
};