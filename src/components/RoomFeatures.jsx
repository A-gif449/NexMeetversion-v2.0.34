// src/components/RoomFeatures.jsx
// UI overlay for all 4 NexMeet features — drop inside your Room.jsx

import { useState } from 'react';

// ── Mini status badge ─────────────────────────────────────────────────────────
function Badge({ color, children }) {
  const colors = {
    green:  { bg: '#e6f9f0', text: '#166534', border: '#86efac' },
    yellow: { bg: '#fefce8', text: '#854d0e', border: '#fde047' },
    red:    { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' },
    blue:   { bg: '#eff6ff', text: '#1e40af', border: '#93c5fd' },
    gray:   { bg: '#f9fafb', text: '#374151', border: '#d1d5db' },
  };
  const c = colors[color] ?? colors.gray;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
    }}>
      {children}
    </span>
  );
}

// ── 1. Rejoin Banner ─────────────────────────────────────────────────────────
// Show this when useMeetingPersistence returns rejoinData
export function RejoinBanner({ rejoinData, onRejoin, onDismiss }) {
  if (!rejoinData) return null;
  const ago = Math.round((Date.now() - rejoinData.lastSeen) / 1000);
  return (
    <div style={{
      position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
      background: '#1e293b', color: '#f8fafc', borderRadius: 12, padding: '12px 20px',
      display: 'flex', alignItems: 'center', gap: 12, zIndex: 1000,
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)', maxWidth: 420, width: '90%',
    }}>
      <span style={{ fontSize: 20 }}>🔄</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Rejoin as {rejoinData.displayName}?</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
          You were here {ago}s ago
        </div>
      </div>
      <button
        onClick={onRejoin}
        style={{
          background: '#3b82f6', color: '#fff', border: 'none',
          borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13,
        }}
      >
        Rejoin
      </button>
      <button
        onClick={onDismiss}
        style={{
          background: 'transparent', color: '#94a3b8', border: '1px solid #334155',
          borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13,
        }}
      >
        New session
      </button>
    </div>
  );
}

// ── 2. Quality Selector ───────────────────────────────────────────────────────
// Plug in: quality, isAuto, setManualQuality, enableAuto from useAdaptiveQuality
export function QualitySelector({ quality, isAuto, setManualQuality, enableAuto }) {
  const [open, setOpen] = useState(false);
  const levels = ['high', 'medium', 'low', 'audio_only'];
  const labels = { high: '720p', medium: '480p', low: '240p', audio_only: 'Audio' };
  const icons  = { high: '🎥', medium: '📹', low: '📱', audio_only: '🎙️' };
  const badgeColor = quality.level === 'high' ? 'green' : quality.level === 'medium' ? 'blue' : quality.level === 'low' ? 'yellow' : 'gray';

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        title="Video Quality"
        style={{
          background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
        }}
      >
        {icons[quality.level]} {labels[quality.level]}
        {isAuto && <Badge color="blue">AUTO</Badge>}
        {!isAuto && <Badge color="gray">MANUAL</Badge>}
      </button>
      {open && (
        <div style={{
          position: 'absolute', bottom: '110%', left: 0,
          background: '#1e293b', border: '1px solid #334155',
          borderRadius: 10, padding: 8, minWidth: 160, zIndex: 100,
        }}>
          <button
            onClick={() => { enableAuto(); setOpen(false); }}
            style={{
              width: '100%', textAlign: 'left', background: isAuto ? '#1d4ed8' : 'transparent',
              color: '#f8fafc', border: 'none', borderRadius: 6, padding: '6px 10px',
              cursor: 'pointer', fontSize: 13, marginBottom: 4,
            }}
          >
            ✨ Auto (Adaptive)
          </button>
          <div style={{ borderTop: '1px solid #334155', margin: '4px 0' }} />
          {levels.map((l) => (
            <button
              key={l}
              onClick={() => { setManualQuality(l); setOpen(false); }}
              style={{
                width: '100%', textAlign: 'left',
                background: !isAuto && quality.level === l ? '#1d4ed8' : 'transparent',
                color: '#f8fafc', border: 'none', borderRadius: 6,
                padding: '6px 10px', cursor: 'pointer', fontSize: 13,
              }}
            >
              {icons[l]} {labels[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 3. Connection Health Indicator ────────────────────────────────────────────
// Plug in: health, stats from useConnectionHealth
export function ConnectionHealth({ health, stats }) {
  const config = {
    good:     { color: '#22c55e', label: 'Good',     icon: '●' },
    degraded: { color: '#f59e0b', label: 'Degraded', icon: '●' },
    poor:     { color: '#ef4444', label: 'Poor',     icon: '●' },
  };
  const cfg = config[health] ?? config.good;

  return (
    <div
      title={`RTT: ${Math.round(stats?.rtt ?? 0)}ms | Loss: ${((stats?.loss ?? 0) * 100).toFixed(1)}%`}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '6px 12px',
        color: '#f8fafc', fontSize: 13, cursor: 'default',
      }}
    >
      <span style={{ color: cfg.color, fontSize: 10 }}>{cfg.icon}</span>
      {cfg.label}
      <span style={{ color: '#94a3b8', fontSize: 11 }}>
        {Math.round(stats?.rtt ?? 0)}ms
      </span>
    </div>
  );
}

// ── 4. Encryption Status Badge ────────────────────────────────────────────────
// Plug in: encryptionStatus from useE2EEncryption
export function EncryptionBadge({ encryptionStatus }) {
  const [showInfo, setShowInfo] = useState(false);
  const active = encryptionStatus?.enabled && encryptionStatus?.keyPairReady;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowInfo(!showInfo)}
        style={{
          background: active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          color: active ? '#22c55e' : '#ef4444',
          border: `1px solid ${active ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
        }}
      >
        {active ? '🔐' : '🔓'} {active ? 'E2E Encrypted' : 'Not Encrypted'}
      </button>
      {showInfo && (
        <div style={{
          position: 'absolute', bottom: '110%', right: 0,
          background: '#0f172a', border: '1px solid #1e293b',
          borderRadius: 10, padding: 14, minWidth: 220, zIndex: 100,
          color: '#f8fafc', fontSize: 12,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
            {active ? '🔐 Encryption Active' : '⚠️ Encryption Inactive'}
          </div>
          {active ? (
            <>
              <div style={{ color: '#94a3b8', marginBottom: 4 }}>
                Algorithm: {encryptionStatus.algorithm}
              </div>
              <div style={{ color: '#94a3b8', marginBottom: 4 }}>
                Peers secured: {encryptionStatus.peersEncrypted}
              </div>
              <div style={{ color: '#22c55e', marginTop: 8, fontSize: 11 }}>
                ✓ Media frames encrypted end-to-end<br />
                ✓ Chat messages encrypted end-to-end<br />
                ✓ Server cannot decrypt your call
              </div>
            </>
          ) : (
            <div style={{ color: '#f59e0b' }}>
              Encryption will activate once all peers have exchanged keys.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Combined toolbar row for your Room.jsx ────────────────────────────────────
// Drop <RoomFeaturesToolbar ... /> anywhere inside your Room component controls bar.
export function RoomFeaturesToolbar({
  quality, isAuto, setManualQuality, enableAuto,   // from useAdaptiveQuality
  health, stats,                                   // from useConnectionHealth
  encryptionStatus,                                // from useE2EEncryption
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <ConnectionHealth health={health} stats={stats} />
      <QualitySelector
        quality={quality}
        isAuto={isAuto}
        setManualQuality={setManualQuality}
        enableAuto={enableAuto}
      />
      <EncryptionBadge encryptionStatus={encryptionStatus} />
    </div>
  );
}