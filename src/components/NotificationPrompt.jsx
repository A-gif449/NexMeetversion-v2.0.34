// src/components/NotificationPrompt.jsx — FIXED (no stuck enabling)
import { useState, useEffect } from 'react';
import NotificationService from './NotificationService';

const NotificationPrompt = ({ firebaseApp }) => {
  const [show, setShow]         = useState(false);
  const [permission, setPermission] = useState('default');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;

    const current = Notification.permission;
    setPermission(current);
    if (current !== 'default') return;

    if (firebaseApp) {
      NotificationService.init(firebaseApp).catch(() => {});
    }

    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, [firebaseApp]);

  if (!show || permission !== 'default') return null;

  const handleAllow = async () => {
    setLoading(true);
    setError('');

    // ── Step 1: Ask browser permission directly first ──────────
    // This is instant and doesn't depend on FCM/service worker.
    let browserPerm;
    try {
      browserPerm = await Notification.requestPermission();
    } catch (e) {
      // Old callback-style API (some browsers)
      browserPerm = await new Promise(resolve => Notification.requestPermission(resolve));
    }

    if (browserPerm !== 'granted') {
      // User clicked Block — just close the prompt
      setPermission(browserPerm);
      setLoading(false);
      setShow(false);
      return;
    }

    // Permission granted — update state & close prompt immediately.
    // Don't wait for FCM token (that can fail silently).
    setPermission('granted');
    setLoading(false);
    setShow(false);

    // ── Step 2: Try to get FCM token in background ─────────────
    // We do this AFTER closing the prompt so the user never sees
    // a stuck state. Failures are logged but not shown to user.
    try {
      await NotificationService.requestPermission();
    } catch (e) {
      console.warn('[NotificationPrompt] FCM token failed (non-critical):', e);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 24,
      right: 24,
      zIndex: 2147483646,
      background: 'linear-gradient(135deg, rgba(30,27,75,0.97), rgba(15,20,40,0.97))',
      color: 'white',
      padding: '18px 20px',
      borderRadius: 16,
      boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,58,237,0.3)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 14,
      maxWidth: 360,
      width: 'calc(100vw - 48px)',
      border: '1px solid rgba(124,58,237,0.25)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      backdropFilter: 'blur(20px)',
      animation: 'nm-prompt-in 0.4s cubic-bezier(0.34,1.56,0.64,1)',
    }}>
      <style>{`
        @keyframes nm-prompt-in {
          from { transform: translateX(120px); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
      `}</style>

      <span style={{ fontSize: 28, flexShrink: 0, lineHeight: 1.3 }}>🔔</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: '#f0efff' }}>
          Stay in the loop
        </div>
        <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5, color: '#c4b5fd' }}>
          Get notified when someone joins, leaves, or sends a message.
        </div>

        {error && (
          <div style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={handleAllow}
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 9,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
              opacity: loading ? 0.7 : 1,
            }}
          >
            Allow ✓
          </button>
          <button
            onClick={() => setShow(false)}
            style={{
              background: 'transparent',
              color: 'rgba(167,139,250,0.6)',
              border: '1px solid rgba(124,58,237,0.2)',
              padding: '8px 14px',
              borderRadius: 9,
              cursor: 'pointer',
              fontSize: 13,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)'}
          >
            Not now
          </button>
        </div>
      </div>

      <button
        onClick={() => setShow(false)}
        style={{ background: 'none', border: 'none', color: 'rgba(167,139,250,0.35)', cursor: 'pointer', padding: '2px 4px', fontSize: 16, lineHeight: 1, flexShrink: 0 }}
      >✕</button>
    </div>
  );
};

export default NotificationPrompt;