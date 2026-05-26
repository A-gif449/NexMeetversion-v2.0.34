// src/components/NotificationService.js — FIXED
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const VAPID_KEY = 'BPDmNt3qpITt6irhvfspeNEF3TZnJfIkk-fxBJzfleXCbg67-ZLcsg12LhB5wuQsCpYcVcWgyXV_cc2GY6Z3Big';

// ─── Sound Engine ──────────────────────────────────────────────────────────────
const AudioEngine = {
  ctx: null,

  getContext() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null;
      }
    }
    // Resume if suspended (browser blocks audio until user gesture)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  },

  playJoin() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1108, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {}
  },

  playMessage() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  },

  playMeetingStart() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.15 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 1);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 1);
      });
    } catch (e) {}
  },

  playLeave() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {}
  },

  playNotification() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      [784, 988].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + i * 0.12 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.5);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.5);
      });
    } catch (e) {}
  },
};

// ─── FIX: Toast uses z-index 2147483647 (max possible) so it
//     always renders above the holographic room's overlay layers ─
const TOAST_CONTAINER_ID = 'nexmeet-toast-root';

function getToastContainer() {
  let container = document.getElementById(TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
      max-width: 340px;
      width: calc(100vw - 40px);
    `;
    document.body.appendChild(container);
  }
  return container;
}

const TYPE_STYLES = {
  join:    { bg: 'rgba(16,185,129,0.95)',  icon: '👋', label: 'Joined'  },
  leave:   { bg: 'rgba(107,114,128,0.95)', icon: '🚪', label: 'Left'    },
  message: { bg: 'rgba(59,130,246,0.95)',  icon: '💬', label: 'Message' },
  meeting: { bg: 'rgba(139,92,246,0.95)',  icon: '🎥', label: 'Meeting' },
  default: { bg: 'rgba(31,41,55,0.95)',    icon: '🔔', label: 'Alert'   },
};

export const showToast = (title, body, type = 'default') => {
  // Safety: don't crash if called outside browser context
  if (typeof document === 'undefined') return;

  const style = TYPE_STYLES[type] || TYPE_STYLES.default;
  const container = getToastContainer();

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: ${style.bg};
    color: white;
    padding: 12px 16px;
    border-radius: 14px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08);
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    pointer-events: all;
    cursor: pointer;
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.12);
    transform: translateX(120px);
    opacity: 0;
    transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease;
    will-change: transform, opacity;
    min-width: 0;
    word-break: break-word;
  `;

  toast.innerHTML = `
    <span style="font-size:20px;flex-shrink:0;line-height:1.4">${style.icon}</span>
    <div style="flex:1;min-width:0">
      <div style="font-weight:700;font-size:13px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${title}</div>
      <div style="opacity:0.85;font-size:12px;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${body}</div>
    </div>
    <span style="font-size:16px;flex-shrink:0;opacity:0.5;line-height:1.4;margin-left:4px">✕</span>
  `;

  container.appendChild(toast);

  // Animate in (next frame so transition fires)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    });
  });

  const remove = () => {
    toast.style.transform = 'translateX(120px)';
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  };

  toast.addEventListener('click', remove);
  setTimeout(remove, 4500);
};

// ─── Main Notification Service ──────────────────────────────────────────────
const NotificationService = {
  messaging: null,
  token: null,
  initialized: false,          // ← guards against double-init

  async init(firebaseApp) {
    if (this.initialized) return true;   // already done, skip

    try {
      if (!('Notification' in window)) return false;

      this.messaging = getMessaging(firebaseApp);
      this.initialized = true;

      onMessage(this.messaging, (payload) => {
        const { title, body } = payload.notification || {};
        const type = payload.data?.type || 'default';
        this.playSound(type);
        showToast(title || 'NexMeet', body || 'New notification', type);
      });

      return true;
    } catch (error) {
      console.error('[NotificationService] init error:', error);
      return false;
    }
  },

  async requestPermission() {
    if (!this.initialized || !this.messaging) return null;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return null;

      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const token = await getToken(this.messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: reg,
      });

      this.token = token;
      return token;
    } catch (error) {
      console.error('[NotificationService] requestPermission error:', error);
      return null;
    }
  },

  playSound(type) {
    try {
      switch (type) {
        case 'join':    AudioEngine.playJoin();         break;
        case 'leave':   AudioEngine.playLeave();        break;
        case 'message': AudioEngine.playMessage();      break;
        case 'meeting': AudioEngine.playMeetingStart(); break;
        default:        AudioEngine.playNotification(); break;
      }
    } catch (e) {}
  },

  notifyUserJoined(userName) {
    this.playSound('join');
    showToast(`${userName} joined`, 'Just joined the meeting', 'join');
  },

  notifyUserLeft(userName) {
    this.playSound('leave');
    showToast(`${userName} left`, 'Left the meeting', 'leave');
  },

  notifyNewMessage(userName, message) {
    this.playSound('message');
    showToast(userName, message.substring(0, 80), 'message');
  },

  notifyMeetingStarting(meetingName) {
    this.playSound('meeting');
    showToast('Meeting Starting', `${meetingName} is starting now!`, 'meeting');
  },
};

export default NotificationService;
export { AudioEngine };