// src/utils/peerOptimizer.js
// Feature 3: Peer Connection Optimization
// Wrap or augment your existing webrtc.js peer creation

// ─── Optimized RTCConfiguration ───────────────────────────────────────────────
// Drop this into wherever you call new RTCPeerConnection()
export const OPTIMIZED_RTC_CONFIG = {
  iceServers: [
    // Google STUN (always include)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Add your own TURN servers here for production:
    // {
    //   urls: ['turn:your-turn-server.com:3478'],
    //   username: 'user',
    //   credential: 'pass',
    // },
  ],
  iceTransportPolicy: 'all',       // 'relay' to force TURN
  bundlePolicy: 'max-bundle',      // bundle all media into one transport
  rtcpMuxPolicy: 'require',        // mux RTCP into RTP port (saves a port)
  sdpSemantics: 'unified-plan',    // modern SDP format
  iceCandidatePoolSize: 4,         // pre-gather ICE candidates
};

// ─── createOptimizedPeerConnection ───────────────────────────────────────────
// Replace `new RTCPeerConnection(config)` with this in your webrtc.js
//
// Usage:
//   const pc = createOptimizedPeerConnection({
//     onConnectionChange: (state) => console.log('State:', state),
//     onIceFailed: () => reconnectManager.start(),
//   });

export function createOptimizedPeerConnection(options = {}, extraConfig = {}) {
  const config = { ...OPTIMIZED_RTC_CONFIG, ...extraConfig };
  const pc = new RTCPeerConnection(config);

  // ── ICE restart on failure ────────────────────────────────────────────────
  pc.oniceconnectionstatechange = () => {
    console.log(`[NexMeet] ICE state: ${pc.iceConnectionState}`);
    options.onConnectionChange?.(pc.iceConnectionState);

    if (pc.iceConnectionState === 'failed') {
      console.warn('[NexMeet] ICE failed — attempting ICE restart');
      try {
        pc.restartIce();
      } catch (e) {
        console.error('[NexMeet] ICE restart failed:', e);
      }
      options.onIceFailed?.();
    }

    if (pc.iceConnectionState === 'disconnected') {
      // Brief grace period before declaring failure
      setTimeout(() => {
        if (pc.iceConnectionState === 'disconnected') {
          options.onIceDisconnected?.();
        }
      }, 5000);
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`[NexMeet] Connection state: ${pc.connectionState}`);
    options.onConnectionStateChange?.(pc.connectionState);
  };

  // ── Log ICE candidate types for debugging ─────────────────────────────────
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      const type = e.candidate.type;  // 'host', 'srflx', 'relay'
      console.log(`[NexMeet] ICE candidate: ${type}`);
    }
    options.onIceCandidate?.(e);
  };

  return pc;
}

// ─── SDP Optimizer ────────────────────────────────────────────────────────────
// Modify SDP offers/answers before sending to prefer better codecs & bitrates
//
// Usage:
//   const offer = await pc.createOffer();
//   const optimized = SDPOptimizer.optimize(offer);
//   await pc.setLocalDescription(optimized);

export const SDPOptimizer = {
  optimize(sessionDescription) {
    let { sdp, type } = sessionDescription;
    sdp = this._preferVideoCodec(sdp, 'VP9');   // VP9 > VP8 in most browsers
    sdp = this._setAudioBitrate(sdp, 64);         // kbps
    sdp = this._enableDtxForOpus(sdp);             // discontinuous transmission
    return new RTCSessionDescription({ type, sdp });
  },

  // Reorder m=video codec lines to put preferred codec first
  _preferVideoCodec(sdp, codec) {
    const lines = sdp.split('\r\n');
    const videoIdx = lines.findIndex((l) => l.startsWith('m=video'));
    if (videoIdx === -1) return sdp;

    const mLine = lines[videoIdx];
    const parts = mLine.split(' ');
    const header = parts.slice(0, 3);          // 'm=video PORT RTP/SAVPF'
    const payloads = parts.slice(3);

    // Find payload types for preferred codec
    const preferredPTs = [];
    const otherPTs = [];
    lines.forEach((l) => {
      const m = l.match(/^a=rtpmap:(\d+) ([A-Za-z0-9-]+)\//);
      if (!m) return;
      const [, pt, name] = m;
      if (name.toUpperCase() === codec.toUpperCase()) {
        preferredPTs.push(pt);
      }
    });
    payloads.forEach((pt) => {
      if (!preferredPTs.includes(pt)) otherPTs.push(pt);
    });

    lines[videoIdx] = [...header, ...preferredPTs, ...otherPTs].join(' ');
    return lines.join('\r\n');
  },

  // Set max audio bitrate via b=AS line
  _setAudioBitrate(sdp, kbps) {
    return sdp.replace(
      /m=audio (\d+) ([^\r\n]+)/,
      `m=audio $1 $2\r\nb=AS:${kbps}`,
    );
  },

  // Enable DTX (silence suppression) for Opus to save bandwidth
  _enableDtxForOpus(sdp) {
    return sdp.replace(/a=fmtp:(\d+) (.*)useinbandfec=1(.*)/g, (match, pt, before, after) => {
      if (match.includes('usedtx')) return match;
      return `a=fmtp:${pt} ${before}useinbandfec=1;usedtx=1${after}`;
    });
  },
};

// ─── ConnectionHealthMonitor ──────────────────────────────────────────────────
// Continuously monitor connection health and emit events.
//
// Usage:
//   const monitor = new ConnectionHealthMonitor(pc);
//   monitor.on('degraded', ({ rtt, loss }) => showWarning());
//   monitor.on('recovered', () => hideWarning());
//   monitor.start();

export class ConnectionHealthMonitor extends EventTarget {
  constructor(pc, options = {}) {
    super();
    this.pc = pc;
    this.pollInterval = options.pollInterval ?? 2000;
    this.rttWarnThreshold = options.rttWarnThreshold ?? 250;   // ms
    this.lossWarnThreshold = options.lossWarnThreshold ?? 0.05; // 5%
    this._timer = null;
    this._health = 'good';   // 'good' | 'degraded' | 'poor'
    this._prev = null;
  }

  // Convenience: register listeners
  on(event, handler) {
    this.addEventListener(event, (e) => handler(e.detail));
    return this;
  }

  get health() { return this._health; }

  start() {
    this._timer = setInterval(() => this._poll(), this.pollInterval);
  }

  stop() {
    clearInterval(this._timer);
  }

  async _poll() {
    if (!this.pc || this.pc.connectionState === 'closed') return;
    try {
      const stats = await this.pc.getStats();
      const metrics = this._parseStats(stats);
      if (!metrics) return;

      const prevHealth = this._health;

      if (metrics.rtt > 500 || metrics.loss > 0.15) {
        this._health = 'poor';
      } else if (metrics.rtt > this.rttWarnThreshold || metrics.loss > this.lossWarnThreshold) {
        this._health = 'degraded';
      } else {
        this._health = 'good';
      }

      if (this._health !== prevHealth) {
        this.dispatchEvent(new CustomEvent(this._health, { detail: metrics }));
        if (prevHealth !== 'good' && this._health === 'good') {
          this.dispatchEvent(new CustomEvent('recovered', { detail: metrics }));
        }
      }

      this.dispatchEvent(new CustomEvent('stats', { detail: { ...metrics, health: this._health } }));
    } catch (e) {}
  }

  _parseStats(report) {
    let rtt = 0;
    let loss = 0;
    let jitter = 0;
    let bytesSent = 0;

    report.forEach((s) => {
      if (s.type === 'candidate-pair' && s.nominated) {
        rtt = (s.currentRoundTripTime ?? 0) * 1000;
      }
      if (s.type === 'outbound-rtp' && s.kind === 'video') {
        bytesSent = s.bytesSent ?? 0;
        if (this._prev) {
          const sent = s.packetsSent - (this._prev.packetsSent ?? 0);
          const lost = (s.packetsLost ?? 0) - (this._prev.packetsLost ?? 0);
          loss = sent > 0 ? Math.max(0, lost / sent) : 0;
        }
        this._prev = s;
      }
      if (s.type === 'inbound-rtp' && s.kind === 'audio') {
        jitter = (s.jitter ?? 0) * 1000;
      }
    });

    return { rtt, loss, jitter, bytesSent };
  }
}

// ─── React Hook ───────────────────────────────────────────────────────────────
// Usage inside Room.jsx:
//   const { health, stats } = useConnectionHealth(peerConnection);

import { useState, useEffect } from 'react';

export function useConnectionHealth(peerConnection) {
  const [health, setHealth] = useState('good');
  const [stats, setStats] = useState({ rtt: 0, loss: 0, jitter: 0 });

  useEffect(() => {
    if (!peerConnection) return;

    const monitor = new ConnectionHealthMonitor(peerConnection);
    monitor
      .on('stats',     (data) => { setHealth(data.health); setStats(data); })
      .on('degraded',  ()     => setHealth('degraded'))
      .on('poor',      ()     => setHealth('poor'))
      .on('recovered', ()     => setHealth('good'));
    monitor.start();

    return () => monitor.stop();
  }, [peerConnection]);

  return { health, stats };
}