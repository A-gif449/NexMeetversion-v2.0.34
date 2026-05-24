// src/utils/adaptiveQuality.js
// Feature 2: Adaptive Video Quality
// Works with your existing utils/webrtc.js peer connections

// ─── Quality Presets ──────────────────────────────────────────────────────────
export const QUALITY_PRESETS = {
  high: {
    label: 'High',
    width: 1280,
    height: 720,
    frameRate: 30,
    maxBitrate: 2_500_000,   // 2.5 Mbps
    maxPacketLoss: 0.02,     // 2% threshold to step down
  },
  medium: {
    label: 'Medium',
    width: 640,
    height: 480,
    frameRate: 24,
    maxBitrate: 1_000_000,  // 1 Mbps
    maxPacketLoss: 0.05,
  },
  low: {
    label: 'Low',
    width: 320,
    height: 240,
    frameRate: 15,
    maxBitrate: 300_000,    // 300 Kbps
    maxPacketLoss: 0.15,
  },
  audio_only: {
    label: 'Audio Only',
    width: 0,
    height: 0,
    frameRate: 0,
    maxBitrate: 64_000,
    maxPacketLoss: 1,
  },
};

const QUALITY_ORDER = ['high', 'medium', 'low', 'audio_only'];

// ─── AdaptiveQualityManager ───────────────────────────────────────────────────
// Attach to a RTCPeerConnection. It polls getStats() and adjusts sender
// encoding parameters automatically.
//
// Usage:
//   const aqm = new AdaptiveQualityManager(peerConnection, localStream);
//   aqm.start();
//   ...
//   aqm.stop();

export class AdaptiveQualityManager {
  constructor(peerConnection, localStream, options = {}) {
    this.pc = peerConnection;
    this.stream = localStream;
    this.pollInterval = options.pollInterval ?? 3000;   // ms between checks
    this.onQualityChange = options.onQualityChange ?? null; // callback(level, preset)
    this.manualOverride = null;   // null = auto; set to level string to lock
    this._currentLevel = 'high';
    this._timer = null;
    this._prevStats = null;
    this._stepDownCooldown = 0;   // prevent flapping
    this._stepUpCooldown = 0;
  }

  get currentLevel() { return this.manualOverride ?? this._currentLevel; }
  get currentPreset() { return QUALITY_PRESETS[this.currentLevel]; }

  // ── Start auto-adaptation ─────────────────────────────────────────────────
  start() {
    this._timer = setInterval(() => this._evaluate(), this.pollInterval);
    console.log('[NexMeet] Adaptive quality started');
  }

  stop() {
    clearInterval(this._timer);
    this._timer = null;
  }

  // ── Manually lock quality (e.g. user picks "Low") ─────────────────────────
  setManualQuality(level) {
    if (!QUALITY_PRESETS[level]) throw new Error(`Unknown quality level: ${level}`);
    this.manualOverride = level;
    this._applyPreset(level);
    if (this.onQualityChange) this.onQualityChange(level, QUALITY_PRESETS[level], 'manual');
  }

  enableAutoQuality() {
    this.manualOverride = null;
  }

  // ── Internal: collect stats and decide ───────────────────────────────────
  async _evaluate() {
    if (this.manualOverride) return;
    if (!this.pc || this.pc.connectionState === 'closed') return;

    try {
      const stats = await this._collectStats();
      if (!stats) return;

      const { packetLoss, roundTripTime, availableBandwidth } = stats;
      const preset = QUALITY_PRESETS[this._currentLevel];

      // Cool-down counters prevent rapid level switching
      if (this._stepDownCooldown > 0) { this._stepDownCooldown--; return; }
      if (this._stepUpCooldown > 0)   { this._stepUpCooldown--;   }

      const shouldStepDown =
        packetLoss > preset.maxPacketLoss ||
        roundTripTime > 300 ||
        (availableBandwidth > 0 && availableBandwidth < preset.maxBitrate * 0.6);

      const currentIdx = QUALITY_ORDER.indexOf(this._currentLevel);
      const canStepUp = currentIdx > 0;
      const canStepDown = currentIdx < QUALITY_ORDER.length - 1;

      if (shouldStepDown && canStepDown) {
        const next = QUALITY_ORDER[currentIdx + 1];
        console.log(`[NexMeet] Quality ↓ ${this._currentLevel} → ${next} (loss=${(packetLoss*100).toFixed(1)}%, rtt=${roundTripTime}ms)`);
        this._currentLevel = next;
        this._applyPreset(next);
        this._stepDownCooldown = 3; // wait 3 polls before stepping down again
        if (this.onQualityChange) this.onQualityChange(next, QUALITY_PRESETS[next], 'auto-down');
        return;
      }

      // Step up only if conditions are clearly good (conservative)
      const shouldStepUp =
        !shouldStepDown &&
        packetLoss < preset.maxPacketLoss * 0.3 &&
        roundTripTime < 150 &&
        this._stepUpCooldown === 0 &&
        canStepUp;

      if (shouldStepUp) {
        const next = QUALITY_ORDER[currentIdx - 1];
        console.log(`[NexMeet] Quality ↑ ${this._currentLevel} → ${next}`);
        this._currentLevel = next;
        this._applyPreset(next);
        this._stepUpCooldown = 5;
        if (this.onQualityChange) this.onQualityChange(next, QUALITY_PRESETS[next], 'auto-up');
      }
    } catch (err) {
      console.warn('[NexMeet] Quality evaluation error:', err);
    }
  }

  // ── Apply encoding parameters to video sender ─────────────────────────────
  async _applyPreset(level) {
    const preset = QUALITY_PRESETS[level];
    try {
      const senders = this.pc.getSenders();
      const videoSender = senders.find((s) => s.track?.kind === 'video');

      if (!videoSender) return;

      if (level === 'audio_only') {
        videoSender.track.enabled = false;
        return;
      }
      videoSender.track.enabled = true;

      // Apply constraints to local track
      await videoSender.track.applyConstraints({
        width: { ideal: preset.width },
        height: { ideal: preset.height },
        frameRate: { ideal: preset.frameRate },
      });

      // Adjust encoding bitrate via RTCRtpSender parameters
      const params = videoSender.getParameters();
      if (!params.encodings?.length) {
        params.encodings = [{}];
      }
      params.encodings[0].maxBitrate = preset.maxBitrate;
      params.encodings[0].maxFramerate = preset.frameRate;
      await videoSender.setParameters(params);
    } catch (err) {
      console.warn('[NexMeet] Could not apply quality preset:', err);
    }
  }

  // ── Parse RTCPeerConnection stats ─────────────────────────────────────────
  async _collectStats() {
    const report = await this.pc.getStats();
    let outboundRtp = null;
    let candidatePair = null;

    report.forEach((stat) => {
      if (stat.type === 'outbound-rtp' && stat.kind === 'video') outboundRtp = stat;
      if (stat.type === 'candidate-pair' && stat.nominated) candidatePair = stat;
    });

    if (!outboundRtp) return null;

    // Compute packet loss delta since last poll
    let packetLoss = 0;
    if (this._prevStats) {
      const sentDelta = outboundRtp.packetsSent - (this._prevStats.packetsSent || 0);
      const lostDelta = (outboundRtp.packetsLost || 0) - (this._prevStats.packetsLost || 0);
      if (sentDelta > 0) packetLoss = Math.max(0, lostDelta / sentDelta);
    }
    this._prevStats = outboundRtp;

    return {
      packetLoss,
      roundTripTime: candidatePair?.currentRoundTripTime
        ? candidatePair.currentRoundTripTime * 1000
        : 0,
      availableBandwidth: candidatePair?.availableOutgoingBitrate ?? 0,
      bytesSent: outboundRtp.bytesSent,
      framesSent: outboundRtp.framesSent,
    };
  }
}

// ─── React Hook ───────────────────────────────────────────────────────────────
// Usage inside Room.jsx:
//   const { quality, setManualQuality, enableAuto } = useAdaptiveQuality(pc, localStream);

import { useState, useEffect, useRef, useCallback } from 'react';

export function useAdaptiveQuality(peerConnection, localStream) {
  const [quality, setQuality] = useState({ level: 'high', preset: QUALITY_PRESETS.high, reason: 'init' });
  const [isAuto, setIsAuto] = useState(true);
  const managerRef = useRef(null);

  useEffect(() => {
    if (!peerConnection || !localStream) return;

    const mgr = new AdaptiveQualityManager(peerConnection, localStream, {
      onQualityChange(level, preset, reason) {
        setQuality({ level, preset, reason });
      },
    });
    managerRef.current = mgr;
    mgr.start();

    return () => mgr.stop();
  }, [peerConnection, localStream]);

  const setManualQuality = useCallback((level) => {
    managerRef.current?.setManualQuality(level);
    setIsAuto(false);
    setQuality({ level, preset: QUALITY_PRESETS[level], reason: 'manual' });
  }, []);

  const enableAuto = useCallback(() => {
    managerRef.current?.enableAutoQuality();
    setIsAuto(true);
  }, []);

  return { quality, isAuto, setManualQuality, enableAuto, presets: QUALITY_PRESETS };
}